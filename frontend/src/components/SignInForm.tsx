"use client"

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { z } from "zod";
import {
  Button,
  Input,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Divider,
} from "@heroui/react";
import {
  Mail,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { signInSchema } from "../../schema/signInSchema";
import { useAuth } from "../contexts/AuthContext";
import { getRedirectPath } from "../utils/routeUtils";

export default function SignInForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithOAuth, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      identifier: "",
      password: ""
    }
  });

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    if (isLoading) return;
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await signIn({
        email: data.identifier,
        password: data.password
      });

      // Redirect to the originally requested page or home
      const redirectPath = getRedirectPath(location, '/');
      navigate(redirectPath, { replace: true });
    } catch (error: any) {
      setAuthError(
        error.message || "An error occurred during sign in process"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth2SignIn = async (provider: 'google' | 'github') => {
    try {
      setAuthError(null);
      setOauthLoading(provider);
      await signInWithOAuth(provider);
    } catch (error: any) {
      setAuthError(
        error.message || `An error occurred during ${provider} sign in`
      );
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto border border-default-200 bg-default-50 shadow-xl sm:max-w-lg">
      <CardHeader className="flex flex-col gap-1 items-center pb-2 px-4 sm:px-6">
        <h1 className="text-xl sm:text-2xl font-bold text-default-900">Welcome Back</h1>
        <p className="text-sm sm:text-base text-default-500 text-center">
          Sign in to experience your podcast
        </p>
      </CardHeader>

      <Divider />

      <CardBody className="py-4 px-4 sm:py-6 sm:px-6">
        {authError && (
          <div 
            id="auth-error"
            className="bg-danger-50 text-danger-700 p-4 rounded-lg mb-6 flex items-center gap-2"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{authError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="identifier"
              className="text-sm font-medium text-default-900"
            >
              Email
            </label>
            <Input
              id="identifier"
              type="email"
              placeholder="your.email@example.com"
              startContent={<Mail className="h-4 w-4 text-default-500" />}
              isInvalid={!!errors.identifier}
              errorMessage={errors.identifier?.message}
              {...register("identifier")}
              className="w-full"
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="password"
                className="text-sm font-medium text-default-900"
              >
                Password
              </label>
            </div>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              startContent={<Lock className="h-4 w-4 text-default-500" />}
              endContent={
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => setShowPassword(!showPassword)}
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-default-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-default-500" />
                  )}
                </Button>
              }
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
              {...register("password")}
              className="w-full"
              aria-describedby={errors.password ? "password-error" : undefined}
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            color="primary"
            className="w-full"
            isLoading={isSubmitting}
            aria-describedby={authError ? "auth-error" : undefined}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative my-6">
          <Divider />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-default-50 px-3 text-sm text-default-500">
              or continue with
            </span>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          <Button
            variant="bordered"
            className="w-full"
            onPress={() => handleOAuth2SignIn('google')}
            isDisabled={isLoading || isSubmitting || oauthLoading !== null}
            isLoading={oauthLoading === 'google'}
            startContent={
              oauthLoading === 'google' ? null : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )
            }
          >
            {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
          </Button>

          <Button
            variant="bordered"
            className="w-full"
            onPress={() => handleOAuth2SignIn('github')}
            isDisabled={isLoading || isSubmitting || oauthLoading !== null}
            isLoading={oauthLoading === 'github'}
            startContent={
              oauthLoading === 'github' ? null : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              )
            }
          >
            {oauthLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}
          </Button>
        </div>
      </CardBody>

      <Divider />

      <CardFooter className="flex justify-center py-3 px-4 sm:py-4 sm:px-6">
        <p className="text-sm text-default-600">
          Don't have an account?{" "}
          <Link
            to="/sign-up"
            className="text-primary hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}