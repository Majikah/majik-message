import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { type Session } from '@supabase/supabase-js'
import type { MajikUserJSON } from '@thezelijah/majik-user'

// Redux state type
export interface UserDataState {
  user: MajikUserJSON | null
  session: Session | null
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  tokenExpireTime: number | null
}

// Redux state types
export interface ReduxUserDataRootState {
  userData: {
    user: MajikUserJSON | null
    session: Session | null
    isAuthenticated: boolean
    accessToken: string | null
    refreshToken: string | null
    tokenExpireTime: number | null
  }
}

const initialState: UserDataState = {
  user: null,
  session: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  tokenExpireTime: null
}

const system = createSlice({
  name: 'userData',
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<Session>) => {
      state.session = action.payload
      state.isAuthenticated = true
      state.accessToken = action.payload.access_token
      state.refreshToken = action.payload.refresh_token
      state.tokenExpireTime = action.payload?.expires_at || null
      // console.log("New Session Saved: ", action.payload);
    },
    setUserData: (state, action: PayloadAction<MajikUserJSON>) => {
      state.user = action.payload
      state.isAuthenticated = true
      // console.log("New User Data Saved: ", action.payload);
    },
    clearSession: (state) => {
      state.session = null
      state.user = null
      state.isAuthenticated = false
      state.accessToken = null
      state.refreshToken = null
      state.tokenExpireTime = null
      console.log('Session Cleared')
    }
  }
})

export const { setSession, setUserData, clearSession } = system.actions
export default system.reducer
