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

import { useState, useEffect } from 'react'
import { getTodayTasks, addTask, completeTask, deleteTask, shouldResetTasks, resetDailyTasks, updateTaskOrder } from '@/lib/tasks'
import { getCurrentProfile } from '@/lib/auth'
import { showModal } from '@/lib/modal'
import type { Task } from '@/lib/supabase'

interface TasksProps {
  userId: string
  onTaskComplete: () => void
}

export default function Tasks({ userId, onTaskComplete }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTask, setNewTask] = useState('')
  const [newReward, setNewReward] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastReset, setLastReset] = useState<string | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  useEffect(() => {
    // Only check reset on initial load
    loadTasks(true)
    // Check for reset every minute
    const interval = setInterval(() => {
      checkReset()
    }, 60000)
    return () => clearInterval(interval)
  }, [userId])

  const checkReset = async () => {
    const storedLastReset = localStorage.getItem(`lastReset_${userId}`)
    if (storedLastReset && shouldResetTasks(storedLastReset)) {
      await resetDailyTasks(userId)
      const newResetTime = new Date().toISOString()
      localStorage.setItem(`lastReset_${userId}`, newResetTime)
      setLastReset(newResetTime)
      await loadTasks(false) // Reload tasks without checking reset again
    }
  }

  const loadTasks = async (checkReset: boolean = false) => {
    try {
      // Only check for reset if explicitly requested (on initial load)
      if (checkReset) {
        const profile = await getCurrentProfile()
        if (profile) {
          const storedLastReset = localStorage.getItem(`lastReset_${userId}`)
          setLastReset(storedLastReset)
          // Only reset if it's actually a new day and past reset time
          if (storedLastReset && shouldResetTasks(storedLastReset)) {
            await resetDailyTasks(userId)
            const newResetTime = new Date().toISOString()
            localStorage.setItem(`lastReset_${userId}`, newResetTime)
            setLastReset(newResetTime)
          } else if (!storedLastReset) {
            // First time, set the reset timestamp
            const newResetTime = new Date().toISOString()
            localStorage.setItem(`lastReset_${userId}`, newResetTime)
            setLastReset(newResetTime)
          }
        }
      }
      // Always reload tasks
      const taskList = await getTodayTasks(userId)
      setTasks(taskList)
    } catch (err) {
      console.error('Error loading tasks:', err)
    }
  }

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
    setLoading(true)
    try {
      await completeTask(taskId, userId)
      // Reload tasks without checking reset (to avoid false resets)
      await loadTasks(false)
      onTaskComplete()
    } catch (err) {
      console.error('Error completing task:', err)
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

  return (
    <div>
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
      
      <form onSubmit={handleAddTask} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className="responsive-flex">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Enter your task..."
              disabled={tasks.length >= 10 || loading}
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
              disabled={tasks.length >= 10 || loading || !newTask.trim()}
              style={{
                padding: '16px 28px',
                background: tasks.length >= 10 || loading || !newTask.trim()
                  ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)'
                  : 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: tasks.length >= 10 || loading || !newTask.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '15px',
                transition: 'all 0.3s ease',
                boxShadow: tasks.length >= 10 || loading || !newTask.trim()
                  ? 'none'
                  : '0 4px 15px rgba(255, 107, 53, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (tasks.length < 10 && !loading && newTask.trim()) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (tasks.length < 10 && !loading && newTask.trim()) {
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
            disabled={tasks.length >= 10 || loading}
            style={{
              padding: '14px 20px',
              background: '#0a0a0a',
              border: '1px solid #3a3a3a',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.3s ease',
              opacity: tasks.length >= 10 || loading ? 0.5 : 1
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
        {tasks.length >= 10 && (
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

      <div>
        {tasks.length === 0 ? (
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'clamp(14px, 3vw, 18px) clamp(15px, 3vw, 20px)',
                  flexWrap: 'wrap',
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
                }}
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

