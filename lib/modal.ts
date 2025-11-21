/**
 * Modal Utility
 * 
 * Provides a simple way to show custom modals instead of browser alerts/confirms
 */

type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm'

interface ModalState {
  isOpen: boolean
  title: string
  message: string
  type: ModalType
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  resolve?: (value: boolean) => void
}

let modalState: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  type: 'info'
}

let setModalState: ((state: ModalState) => void) | null = null

export function setModalStateSetter(setter: (state: ModalState) => void) {
  setModalState = setter
}

export function showModal(
  title: string,
  message: string,
  type: ModalType = 'info'
): Promise<void> {
  return new Promise((resolve) => {
    if (!setModalState) {
      console.error('Modal state setter not initialized')
      return
    }
    
    modalState = {
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => resolve(),
      resolve: () => resolve()
    }
    
    setModalState(modalState)
  })
}

export function showConfirm(
  title: string,
  message: string
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setModalState) {
      console.error('Modal state setter not initialized')
      resolve(false)
      return
    }
    
    modalState = {
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => resolve(true),
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      resolve: (value: boolean) => resolve(value)
    }
    
    setModalState(modalState)
  })
}

export function closeModal() {
  if (!setModalState) return
  
  if (modalState.resolve) {
    modalState.resolve(false)
  }
  
  modalState = {
    ...modalState,
    isOpen: false
  }
  
  setModalState(modalState)
}

export function getModalState(): ModalState {
  return modalState
}

