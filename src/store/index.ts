/**
 * The Redux store: state that lives only on this device.
 *
 * This project's rule of thumb:
 *   - Data that has a row in Supabase (profiles, cars, crews...) → TanStack Query, NOT here.
 *   - Device/app state (auth status, Ghost Mode, active convoy, data-saver) → Redux, here.
 */
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import { authReducer } from '@/features/auth/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use these instead of plain useDispatch/useSelector so TypeScript knows the state shape.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
