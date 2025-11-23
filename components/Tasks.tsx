/**
 * Tasks Component
 * 
 * Manages daily tasks for the user:
 * - Displays up to 10 tasks per day
 * - Allows adding new tasks
 * - Allows marking tasks as done (which updates level and exp)
 * - Automatically checks for daily reset at 5pm EST
 * 
 * Communicates with Supabase tasks table:
 * - Reads tasks using getTodayTasks()
 * - Creates tasks using addTask()
 * - Updates tasks using completeTask() which also updates profile
 * - Deletes tasks using deleteTask()
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getTodayTasks, addTask, completeTask, deleteTask, shouldResetTasks, resetDailyTasks, shouldResetAvatar, resetAvatar, updateTaskOrder } from '@/lib/tasks'
import { getCurrentProfile } from '@/lib/auth'
import { showModal } from '@/lib/modal'
import { supabase, resetSupabaseClient, abortAllPendingRequests } from '@/lib/supabase'
import { withRetry, refreshSession, wasTabRecentlyHidden } from '@/lib/supabase-helpers'
import type { Task, Profile } from '@/lib/supabase'

interface TasksProps {
  userId: string
  onTaskComplete: (updatedProfile?: Profile) => void
}

// ============================================================================
// STATE SETUP
// ============================================================================

export default function Tasks({ userId, onTaskComplete }: TasksProps) {
  // Task data
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [newReward, setNewReward] = useState('')
  
  // Loading states
  // - `loading`: Controls UI loading indicator and disables interactive elements
  const [loading, setLoading] = useState(true)
  
  // Reset tracking
  const [lastReset, setLastReset] = useState<string | null>(null)
  
  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  
  // Component lifecycle tracking
  const mountedRef = useRef(true)
  // Simple flag to prevent duplicate calls - using ref for synchronous access
  const isLoadingRef = useRef(false)
  // Track if we've loaded initial data - used to determine if we should show loading UI
  const hasInitialDataRef = useRef(false)
  // Store latest loadTasks function in ref to avoid stale closures
  const loadTasksRef = useRef<((checkReset: boolean, silent?: boolean) => Promise<void>) | null>(null)

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Gets localStorage keys for reset tracking
   */
  const getResetKeys = useCallback(() => ({
    taskReset: `lastReset_${userId}`,
    avatarReset: `lastAvatarReset_${userId}`
  }), [userId])

  /**
   * Handles daily reset checks and updates localStorage
   * Only called on initial mount (checkReset=true) to avoid unnecessary checks
   */
  const handleDailyReset = useCallback(async () => {
    const profile = await getCurrentProfile()
    if (!profile || !mountedRef.current) return

    const keys = getResetKeys()
    const storedLastReset = localStorage.getItem(keys.taskReset)
    setLastReset(storedLastReset)
    
    // Check if tasks should reset (new day, past 5pm EST)
    if (storedLastReset && shouldResetTasks(storedLastReset)) {
      await resetDailyTasks(userId)
      const newResetTime = new Date().toISOString()
      localStorage.setItem(keys.taskReset, newResetTime)
      if (mountedRef.current) setLastReset(newResetTime)
    } else if (!storedLastReset) {
      // First time, set the reset timestamp
      const newResetTime = new Date().toISOString()
      localStorage.setItem(keys.taskReset, newResetTime)
      if (mountedRef.current) setLastReset(newResetTime)
    }
    
    // Check and reset avatar at 5pm EST (independent of task reset)
    const storedLastAvatarReset = localStorage.getItem(keys.avatarReset)
    if (storedLastAvatarReset && shouldResetAvatar(storedLastAvatarReset)) {
      await resetAvatar(userId)
      const newAvatarResetTime = new Date().toISOString()
      localStorage.setItem(keys.avatarReset, newAvatarResetTime)
    } else if (!storedLastAvatarReset) {
      // First time, set the avatar reset timestamp
      const newAvatarResetTime = new Date().toISOString()
      localStorage.setItem(keys.avatarReset, newAvatarResetTime)
    }
  }, [userId, getResetKeys])

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Loads tasks from Supabase with proper race condition prevention
   * @param checkReset - If true, checks for daily reset at 5pm EST (only on initial mount)
   * @param silent - If true, doesn't show loading state (for background refreshes)
   */
  const loadTasks = useCallback(async (checkReset: boolean = false, silent: boolean = false) => {
    console.log("Tasks: loadTasks called, checkReset:", checkReset, "isLoading:", isLoadingRef.current, "silent:", silent);
    
    // Prevent multiple simultaneous calls - skip if already loading
    if (isLoadingRef.current) {
      console.log("Tasks: Already loading, skipping");
      return;
    }

    // Check if component is still mounted
    if (!mountedRef.current) {
      console.log("Tasks: Component unmounted, skipping");
      return;
    }

    console.log("Tasks: Starting load...");
    
    // Set loading flag to true BEFORE starting fetch - prevents duplicate calls
    isLoadingRef.current = true;
    // Only show loading UI if we haven't loaded initial data yet and not silent
    if (!silent && !hasInitialDataRef.current) {
      setLoading(true);
    }

    try {
      // Only check for daily reset on initial mount (checkReset=true)
      if (checkReset) {
        await handleDailyReset();
      }

      // Verify session is valid before making request
      console.log("Tasks: Checking session...");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        console.error("Tasks: Failed to load tasks: No valid session", sessionError);
        isLoadingRef.current = false;
        setLoading(false);
        return;
      }
      console.log("Tasks: Session valid, user:", session.user?.id);

      // Fetch tasks with retry and timeout handling
      const taskList = await withRetry(
        ({ signal }) => getTodayTasks(userId, signal),
        { maxRetries: 3, timeout: 15000 }
      );

      // Only update state if component is still mounted
      if (mountedRef.current) {
        console.log("Tasks: Updating state with", taskList.length, "tasks");
        setTasks(taskList);
        // Mark that we've loaded initial data
        hasInitialDataRef.current = true;
        console.log("Tasks: State updated successfully");
      } else {
        console.log("Tasks: Component unmounted, skipping state update");
      }
    } catch (err: any) {
      console.error("Tasks: Failed to load tasks:", err?.message || err);
    } finally {
      // Always reset loading flag
      isLoadingRef.current = false;
      // Only clear loading state if we were showing it (not silent refresh)
      if (!silent) {
        setLoading(false);
      }
      console.log("Tasks: loadTasks completed, isLoading:", isLoadingRef.current);
    }
  }, [userId, handleDailyReset]);

  // Store latest loadTasks in ref so visibility handler always has current version
  loadTasksRef.current = loadTasks

  // ============================================================================
  // RESET LOGIC
  // ============================================================================

  /**
   * Checks if daily reset should occur and handles it
   * Called periodically (every minute) to catch reset time
   */
  const checkReset = async () => {
    const keys = getResetKeys()
    const storedLastReset = localStorage.getItem(keys.taskReset)
    
    if (storedLastReset && shouldResetTasks(storedLastReset)) {
      await resetDailyTasks(userId)
      const newResetTime = new Date().toISOString()
      localStorage.setItem(keys.taskReset, newResetTime)
      setLastReset(newResetTime)
      await loadTasks(false) // Reload tasks without checking reset again
    }
    
    // Check and reset avatar at 5pm EST (independent of task reset)
    const storedLastAvatarReset = localStorage.getItem(keys.avatarReset)
    if (storedLastAvatarReset && shouldResetAvatar(storedLastAvatarReset)) {
      await resetAvatar(userId)
      const newAvatarResetTime = new Date().toISOString()
      localStorage.setItem(keys.avatarReset, newAvatarResetTime)
      // Reload profile to reflect avatar change
      if (onTaskComplete) {
        onTaskComplete()
      }
    }
  }

  // ============================================================================
  // LIFECYCLE (useEffect)
  // ============================================================================

  useEffect(() => {
    mountedRef.current = true;

    // If tab was recently hidden, reset client before first load
    const initializeAndLoad = async () => {
      if (wasTabRecentlyHidden()) {
        abortAllPendingRequests()
        resetSupabaseClient()
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      if (mountedRef.current) {
        loadTasks(true)
      }
    }
    initializeAndLoad()
    
    // Check for reset every minute (for daily task reset at 5pm EST)
    const interval = setInterval(() => {
      if (mountedRef.current) {
        checkReset()
      }
    }, 60000);

    // Refresh data when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.hidden || !mountedRef.current) return
      
      console.log('Tasks: Tab visible, aborting requests and resetting...')
      
      // CRITICAL: Abort all pending requests first
      abortAllPendingRequests()
      
      // Reset client to force fresh connections
      resetSupabaseClient()
      
      // Wait longer for network to be ready after tab switch
      // Browsers need time to restore network connections
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      if (document.hidden || !mountedRef.current) return
      
      // Check network connectivity before proceeding
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('Tasks: Network offline, skipping refresh')
        return
      }
      
      // Refresh session (non-blocking)
      refreshSession().catch(() => {})
      
      // Wait additional time for session refresh, then load data
      setTimeout(() => {
        if (!document.hidden && mountedRef.current && loadTasksRef.current) {
          console.log('Tasks: Loading data after tab switch...')
          loadTasksRef.current(false, true)
        }
      }, 1500)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      isLoadingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]) // loadTasks and checkReset are stable - they use refs for state management

  // ============================================================================
  // CRUD HANDLERS
  // ============================================================================

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.trim() || tasks.length >= 10) return

    setLoading(true)
    try {
      const task = await addTask(userId, newTask.trim(), newReward.trim() || null)
      setTasks([...tasks, task])
      setNewTask('')
      setNewReward('')
    } catch (err: any) {
      await showModal('Error', err.message || 'Failed to add task', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    // Optimistically update the UI immediately
    const taskIndex = tasks.findIndex(t => t.id === taskId)
    if (taskIndex === -1) return
    
    const originalTasks = [...tasks]
    const updatedTasks = [...tasks]
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], is_done: true }
    setTasks(updatedTasks)
    
    setLoading(true)
    try {
      // Pass current tasks to avoid re-fetching
      const updatedProfile = await completeTask(taskId, userId, tasks)
      
      // Tasks are already updated optimistically, no need to re-fetch
      // The optimistic update is correct since we passed the current tasks array
      
      // Pass updated profile to parent to avoid re-fetching
      if (onTaskComplete) {
        onTaskComplete(updatedProfile)
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setTasks(originalTasks)
      await showModal('Error', err.message || 'Failed to complete task', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    setLoading(true)
    try {
      await deleteTask(taskId)
      setTasks(tasks.filter(t => t.id !== taskId))
    } catch (err) {
      console.error('Error deleting task:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // DRAG & DROP HANDLERS
  // ============================================================================

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', taskId)
  }

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedTaskId && draggedTaskId !== taskId) {
      setDragOverTaskId(taskId)
    }
  }

  const handleDragLeave = () => {
    setDragOverTaskId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    setDragOverTaskId(null)
    
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null)
      return
    }

    const draggedTask = tasks.find(t => t.id === draggedTaskId)
    const targetTask = tasks.find(t => t.id === targetTaskId)
    
    if (!draggedTask || !targetTask) {
      setDraggedTaskId(null)
      return
    }

    // Create new order array
    const newTasks = [...tasks]
    const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId)
    const targetIndex = newTasks.findIndex(t => t.id === targetTaskId)
    
    // Remove dragged task from its position
    const [removed] = newTasks.splice(draggedIndex, 1)
    // Insert at target position
    newTasks.splice(targetIndex, 0, removed)
    
    // Update task_order for all tasks
    const taskOrders = newTasks.map((task, index) => ({
      taskId: task.id,
      order: index
    }))

    setLoading(true)
    try {
      await updateTaskOrder(userId, taskOrders)
      // Update local state with new order
      setTasks(newTasks.map((task, index) => ({ ...task, task_order: index })))
    } catch (err) {
      console.error('Error reordering tasks:', err)
      await showModal('Error', 'Failed to reorder tasks', 'error')
    } finally {
      setLoading(false)
      setDraggedTaskId(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  // ============================================================================
  // STYLE HELPERS
  // ============================================================================

  const getTaskItemStyle = (task: Task) => ({
    display: 'flex',
    alignItems: 'center',
    padding: 'clamp(14px, 3vw, 18px) clamp(15px, 3vw, 20px)',
    flexWrap: 'wrap' as const,
    gap: '10px',
    background: task.is_done
      ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)'
      : draggedTaskId === task.id
      ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
      : dragOverTaskId === task.id
      ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.2) 0%, rgba(255, 107, 53, 0.1) 100%)'
      : 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    border: task.is_done
      ? '1px solid rgba(76, 175, 80, 0.3)'
      : dragOverTaskId === task.id
      ? '2px solid #ff6b35'
      : '1px solid #3a3a3a',
    borderRadius: '12px',
    transition: 'all 0.3s ease',
    boxShadow: task.is_done 
      ? '0 4px 15px rgba(76, 175, 80, 0.2)' 
      : dragOverTaskId === task.id
      ? '0 4px 20px rgba(255, 107, 53, 0.4)'
      : 'none',
    cursor: task.is_done || loading ? 'default' : 'grab',
    opacity: draggedTaskId === task.id ? 0.5 : 1,
    transform: draggedTaskId === task.id ? 'scale(0.98)' : 'scale(1)'
  })

  const isMaxTasks = tasks.length >= 10
  const canAddTask = !isMaxTasks && !loading && newTask.trim()

  // ============================================================================
  // UI RENDER
  // ============================================================================

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{
          fontSize: 'clamp(24px, 5vw, 32px)',
          fontWeight: 800,
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #ffffff 0%, #ff6b35 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>DAILY TASKS</h2>
        <p style={{ color: '#888', fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: 500 }}>
          Complete tasks to level up • {tasks.length}/10 slots used
        </p>
      </div>
      
      {/* Add Task Form */}
      <form onSubmit={handleAddTask} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="responsive-flex">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Enter your task..."
              disabled={isMaxTasks || loading}
              style={{
                flex: 1,
                padding: '16px 20px',
                background: '#0a0a0a',
                border: '1px solid #3a3a3a',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#ff6b35'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#3a3a3a'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              type="submit"
              disabled={!canAddTask}
              style={{
                padding: '16px 28px',
                background: canAddTask
                  ? 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)'
                  : 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: canAddTask ? 'pointer' : 'not-allowed',
                fontWeight: 700,
                fontSize: '15px',
                transition: 'all 0.3s ease',
                boxShadow: canAddTask ? '0 4px 15px rgba(255, 107, 53, 0.4)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (canAddTask) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (canAddTask) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.4)'
                }
              }}
            >
              ADD
            </button>
          </div>
          <input
            type="text"
            value={newReward}
            onChange={(e) => setNewReward(e.target.value)}
            placeholder="Optional: Enter reward for completing this task..."
            disabled={isMaxTasks || loading}
            style={{
              padding: '14px 20px',
              background: '#0a0a0a',
              border: '1px solid #3a3a3a',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.3s ease',
              opacity: isMaxTasks || loading ? 0.5 : 1
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#ffd700'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 215, 0, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#3a3a3a'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
        {isMaxTasks && (
          <div style={{
            color: '#ff6b35',
            marginTop: '10px',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px',
            background: 'rgba(255, 107, 53, 0.1)',
            border: '1px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '8px'
          }}>
            Maximum 10 tasks per day reached
          </div>
        )}
      </form>

      {/* Tasks List */}
      <div>
        {/* Always render the container - never return null based on empty data */}
        {/* Show loading indicator while fetching, then show content or empty state */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#0a0a0a',
            borderRadius: '16px',
            border: '1px solid #3a3a3a'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #2a2a2a',
              borderTop: '4px solid #ff6b35',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>Loading tasks...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#0a0a0a',
            borderRadius: '16px',
            border: '1px solid #3a3a3a'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>💪</div>
            <p style={{ color: '#888', fontSize: '16px', fontWeight: 500 }}>
              No tasks yet. Add your first task above!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tasks.map((task) => (
              <div
                key={task.id}
                draggable={!task.is_done && !loading}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, task.id)}
                onDragEnd={handleDragEnd}
                style={getTaskItemStyle(task)}
              >
                {/* Drag Handle */}
                {!task.is_done && (
                  <div
                    style={{
                      marginRight: '8px',
                      color: '#666',
                      fontSize: '16px',
                      cursor: 'grab',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      lineHeight: '1'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span style={{ 
                      display: 'inline-block',
                      transform: 'rotate(90deg)',
                      letterSpacing: '2px'
                    }}>⋮⋮</span>
                  </div>
                )}
                <input
                  type="checkbox"
                  checked={task.is_done}
                  onChange={() => !task.is_done && handleCompleteTask(task.id)}
                  disabled={task.is_done || loading}
                  style={{
                    marginRight: '16px',
                    width: '24px',
                    height: '24px',
                    cursor: task.is_done || loading ? 'not-allowed' : 'pointer',
                    accentColor: '#ff6b35',
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      textDecoration: task.is_done ? 'line-through' : 'none',
                      opacity: task.is_done ? 0.5 : 1,
                      color: task.is_done ? '#888' : '#fff',
                      fontSize: '15px',
                      fontWeight: task.is_done ? 500 : 600
                    }}
                  >
                    {task.description}
                  </span>
                  {task.reward && (
                    <span
                      style={{
                        fontSize: '13px',
                        color: task.is_done ? '#888' : '#ffd700',
                        fontWeight: 600,
                        fontStyle: 'italic',
                        opacity: task.is_done ? 0.5 : 1
                      }}
                    >
                      🎁 Reward: {task.reward}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 68, 68, 0.1)',
                    color: '#ff4444',
                    border: '1px solid rgba(255, 68, 68, 0.3)',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)'
                      e.currentTarget.style.borderColor = '#ff4444'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = 'rgba(255, 68, 68, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 68, 68, 0.3)'
                    }
                  }}
                >
                  DELETE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
