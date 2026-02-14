import React, { useState } from 'react'
import styled from 'styled-components'
import { useMajikah } from '../majikah-session-wrapper/use-majikah'
import { toast } from 'sonner'
import { isDevEnvironment, isPasswordValidSafe } from '@renderer/utils/utils'
import type {
  API_RESPONSE_SIGN_IN,
  API_RESPONSE_SIGN_UP
} from '../majikah-session-wrapper/api-types'

import { useMajik } from '../majik-context-wrapper/use-majik'

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@renderer/globals/styled-dialogs'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { MajikUser } from '@thezelijah/majik-user'
import DuoButton from './DuoButton'
import CustomInputField from './CustomInputField'

const RootContainer = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: transparent;
  padding: 2rem;
`

const AuthCard = styled.div`
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
  padding: 2.5rem 2rem;

  @media (max-width: 480px) {
    padding: 2rem 1.5rem;
  }
`

const LogoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
`

const Logo = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  color: white;
  font-weight: 600;
  margin-bottom: 0.75rem;
  overflow: hidden;
`

const BrandName = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`

const CompanyName = styled.p`
  font-size: 0.8rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
`

const Button = styled.button`
  padding: 0.75rem;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryBackground};
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.textPrimary};
    border: 1px solid ${({ theme }) => theme.colors.primary};
  }

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.primaryBackground};
    cursor: not-allowed;
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.2;
  }
`

const ForgotPassword = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  align-self: flex-end;
  transition: color 0.2s;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: underline;
  }
`

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.875rem;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  }

  &::before {
    margin-right: 0.75rem;
  }

  &::after {
    margin-left: 0.75rem;
  }
`

const SecondaryButton = styled(Button)`
  background: ${({ theme }) => theme.colors.primaryBackground};
  color: ${({ theme }) => theme.colors.textPrimary};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  width: 100%;
  transition: all 0.3s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
    color: ${({ theme }) => theme.colors.primaryBackground};
  }
`

const ErrorMessage = styled.div`
  padding: 0.75rem;
  background: ${({ theme }) => theme.colors.semitransparent};
  color: ${({ theme }) => theme.colors.error};
  border-radius: 6px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
`

const ScrollContainer = styled.div`
  width: inherit;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; // IMPORTANT for iOS
  touch-action: pan-y; // Allows drag scroll
  display: flex;
  flex-direction: column;
  max-height: 400px;

  @media (max-width: 768px) {
    padding: 0px;
  }

  /* Custom Scrollbar Styling */
  &::-webkit-scrollbar {
    width: 4px; /* Width of the entire scrollbar */
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0); /* Background color of the scrollbar track */
    border-radius: 24px; /* Rounded corners of the scrollbar track */
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0); /* Color of the scrollbar thumb */
    border-radius: 24px; /* Rounded corners of the scrollbar thumb */
    border: 2px solid ${({ theme }) => theme.colors.textSecondary}; /* Space around the thumb */
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0); /* Color when hovering over the scrollbar thumb */
  }

  /* Custom Scrollbar for Firefox */
  scrollbar-width: thin; /* Makes the scrollbar thinner */
  scrollbar-color: ${({ theme }) => theme.colors.primary} rgba(0, 0, 0, 0); /* Thumb and track colors */

  position: relative;
`

const OtpInput = styled.input`
  padding: 0.75rem;
  font-size: 1.25rem;
  background: ${({ theme }) => theme.colors.secondaryBackground};
  border: 1px solid ${({ theme }) => theme.colors.primaryBackground};
  margin: 10px;
  border-radius: 6px;
  text-align: center;
  letter-spacing: 0.25rem;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

type AuthMode = 'signin' | 'signup'

interface UserInfoInput {
  first_name: string
  family_name: string
  avatar_url: string
  picture: string
  gender: string
}

interface UserAuthProps {
  onSignIn?: (response: API_RESPONSE_SIGN_IN) => void
  onSignUp?: (response: API_RESPONSE_SIGN_UP) => void
  onResetPassword?: () => void
}

const UserAuth: React.FC<UserAuthProps> = ({ onSignIn, onSignUp, onResetPassword }) => {
  const { majikah, reloadSession } = useMajikah()
  const { majik } = useMajik()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const [isOtpStep, setIsOtpStep] = useState<boolean>(false)
  const [otp, setOtp] = useState<string>('')
  const [otpError, setOtpError] = useState<string>('')
  const [otpEmail, setOtpEmail] = useState<string>('') // store email needing OTP

  const [userInfo, setUserInfo] = useState<UserInfoInput>({
    first_name: '',
    family_name: '',
    avatar_url: 'https://storage.majikah.solutions/public/Majikah_Default_User.webp',
    picture: 'https://storage.majikah.solutions/public/Majikah_Default_User.webp',
    gender: 'Other'
  })

  const processSignIn = async (): Promise<string> => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required.')
    }

    setIsLoading(true)

    try {
      const signInResponse = await majikah.signIn({ email, password })
      const userName = majikah.user?.displayName || 'user'

      if (signInResponse !== null && signInResponse.session) {
        onSignIn?.(signInResponse)
        majik.user = MajikUser.fromJSON(signInResponse.user)
        return `Welcome back, ${userName}! ${signInResponse.message}`
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setIsLoading(false)
      // Handle EmailNotConfirmedError specifically
      if (error?.code === 'EMAIL_NOT_CONFIRMED') {
        console.log('Email not confirmed')
        setOtpEmail(error.email)
        setIsOtpStep(true)
        return 'OTP has been sent to your email. Please verify.'
      } else {
        return `Oh no... There's a problem while signing in.`
      }
    }
    return `Oh no... There's a problem while signing in.`
  }

  const processSignUp = async (): Promise<string> => {
    if (isDevEnvironment()) console.log('Signing In')

    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required.')
    }

    if (!userInfo?.first_name?.trim() || !userInfo?.family_name?.trim()) {
      throw new Error('First name and last name are required.')
    }

    setIsLoading(true)

    const userAttribs = {
      ...userInfo,
      email: email,
      full_name: `${userInfo.first_name.trim()} ${userInfo.family_name.trim()}`,
      name: `${userInfo.first_name.trim()} ${userInfo.family_name.trim()}`,
      display_name: userInfo.first_name.trim()
    }

    const signUpResponse = await majikah.signUp({
      email,
      password,
      options: {
        data: userAttribs
      }
    })

    const userName = majikah.user?.displayName || 'user'

    if (signUpResponse !== null && signUpResponse.message) {
      onSignUp?.(signUpResponse)
      setOtpEmail(email)
      setIsOtpStep(signUpResponse?.requiresEmailConfirmation || true)
      return `Awesome! Your account is now ready, ${userName}! Check your email for the OTP code.`
    } else {
      return `Oh no... There's a problem while signing up.`
    }
  }

  const handleOTPSubmit = async (): Promise<void> => {
    setOtpError('')
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit code')
      return
    }

    setIsLoading(true)
    try {
      const response = await majikah.verifyOTP({
        email: otpEmail,
        otp
      })

      if (response?.session) {
        toast.success('OTP verified successfully!')
        setIsOtpStep(false)
        reloadSession?.()
      } else {
        setOtpError('Invalid OTP. Please try again.')
      }
    } catch (err) {
      console.error(err)
      setOtpError(err instanceof Error ? err.message : 'OTP verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    setError('')

    if (isLoading) return

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      if (mode === 'signin') {
        toast.promise(processSignIn(), {
          loading: `Signing in...`,
          success: (outputMessage) => {
            setTimeout(() => {
              setIsLoading(false)
              reloadSession?.()
            }, 1000)

            return outputMessage
          },
          error: (error) => {
            setIsLoading(false)
            return `${error.message}`
          }
        })
      } else if (mode === 'signup') {
        toast.promise(processSignUp(), {
          loading: `Preparing your account...`,
          success: (outputMessage) => {
            setTimeout(() => {
              setIsLoading(false)
              reloadSession?.()
            }, 1000)

            return outputMessage
          },
          error: (error) => {
            setIsLoading(false)
            return `${error.message}`
          }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      toast.error('Login Failed', {
        description: err instanceof Error ? err.message : 'An error occurred',
        id: `toast-error-login`
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (): Promise<void> => {
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      onResetPassword?.()
      const resetResponse = await majikah.resetPassword(email)

      toast.info(resetResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = (): void => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <RootContainer>
      <AuthCard>
        <LogoContainer>
          <Logo>
            <img src="./favicon-128x128.png" alt="Majik Message Logo" />
          </Logo>
          <BrandName>Majik Message</BrandName>
          <CompanyName>by Majikah</CompanyName>
        </LogoContainer>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        <ScrollContainer>
          <FormContainer>
            <CustomInputField
              label="Email"
              required={true}
              type={'email'}
              minChar={8}
              sensitive={true}
              currentValue={email}
              onChange={setEmail}
              placeholder="you@majikah.solutions"
              disabled={isLoading}
            />

            <CustomInputField
              label="Password"
              required={true}
              type="password"
              passwordType="CASED-DIGITS-SYMBOLS"
              minChar={8}
              sensitive={true}
              currentValue={password}
              onChange={setPassword}
              placeholder="••••••••"
              disabled={isLoading}
            />

            {mode === 'signup' && (
              <>
                <CustomInputField
                  label="Confirm Password"
                  required={true}
                  type="password"
                  passwordType="CASED-DIGITS-SYMBOLS"
                  minChar={8}
                  sensitive={true}
                  currentValue={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="••••••••"
                  disabled={isLoading}
                />

                <CustomInputField
                  label="First Name"
                  required={true}
                  regex="letters"
                  maxChar={100}
                  sensitive={true}
                  currentValue={userInfo.first_name}
                  onChange={(val) => setUserInfo((prev) => ({ ...prev, first_name: val }))}
                  placeholder="Juan"
                  disabled={isLoading}
                />

                <CustomInputField
                  label="Surname"
                  required={true}
                  regex="letters"
                  maxChar={100}
                  sensitive={true}
                  currentValue={userInfo.family_name}
                  onChange={(val) => setUserInfo((prev) => ({ ...prev, family_name: val }))}
                  placeholder="Delos Santos"
                  disabled={isLoading}
                />
              </>
            )}

            {mode === 'signin' && (
              <ForgotPassword onClick={handleForgotPassword} disabled={isLoading}>
                Forgot password?
              </ForgotPassword>
            )}

            <Button
              onClick={handleSubmit}
              disabled={
                isLoading ||
                !isPasswordValidSafe(password, 8, 'CASED-DIGITS-SYMBOLS') ||
                !email?.trim() ||
                (mode === 'signup' && password !== confirmPassword)
              }
            >
              {isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </Button>
          </FormContainer>
        </ScrollContainer>
        <Divider>or</Divider>

        <SecondaryButton onClick={toggleMode} disabled={isLoading}>
          {mode === 'signin' ? 'Create an account' : 'Already have an account?'}
        </SecondaryButton>
      </AuthCard>

      <AlertDialog.Root open={isOtpStep} onOpenChange={setIsOtpStep}>
        <AlertDialog.Portal>
          <DialogOverlay>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm OTP</DialogTitle>
                <DialogDescription></DialogDescription>
              </DialogHeader>
              <ModalContainer>
                <Label>Enter the 6-digit OTP sent to {otpEmail}</Label>
                <OtpInput
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleOTPSubmit()}
                />
                <DuoButton
                  textButtonA={'Cancel'}
                  textButtonB={isLoading ? 'Verifying...' : 'Verify OTP'}
                  onClickButtonA={() => setIsOtpStep(false)}
                  onClickButtonB={handleOTPSubmit}
                  isDisabledButtonB={isLoading || otp.length !== 6}
                />
                {otpError && <ErrorMessage>{otpError}</ErrorMessage>}
              </ModalContainer>
            </DialogContent>
          </DialogOverlay>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </RootContainer>
  )
}

export default UserAuth

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;

  padding: 1rem 50px;
`
