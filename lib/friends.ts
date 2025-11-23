/**
 * Friend System Utilities
 * 
 * Functions for managing friend requests:
 * - sendFriendRequest: Sends a friend request to another user
 * - getFriendRequests: Gets pending requests (sent or received)
 * - acceptFriendRequest: Accepts a pending request
 * - rejectFriendRequest: Rejects a pending request
 * - getFriends: Gets all accepted friends for a user
 * 
 * The friend system allows users to send requests, which can be accepted or rejected.
 */

import { supabase } from './supabase'
import type { FriendRequest } from './supabase'

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
  // Check if request already exists
  const { data: existing } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .single()

  if (existing) {
    throw new Error('Friend request already sent')
  }

  const { data, error } = await ((supabase
    .from('friend_requests') as any)
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
    })
    .select()
    .single())

  if (error) throw error
  return data
}

export async function getFriendRequests(userId: string, signal?: AbortSignal): Promise<FriendRequest[]> {
  const query = supabase
    .from('friend_requests')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await ((supabase
    .from('friend_requests') as any)
    .update({ status: 'accepted' })
    .eq('id', requestId))

  if (error) throw error
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  const { error } = await ((supabase
    .from('friend_requests') as any)
    .update({ status: 'rejected' })
    .eq('id', requestId))

  if (error) throw error
}

export async function getFriends(userId: string, signal?: AbortSignal): Promise<FriendRequest[]> {
  const query = supabase
    .from('friend_requests')
    .select('*')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

  if (signal) {
    query.abortSignal(signal)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

