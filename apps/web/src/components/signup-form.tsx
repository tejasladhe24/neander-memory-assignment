import { useForm } from "@tanstack/react-form"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldError,
} from "@workspace/ui/components/field"

import { z } from "zod"
import { toast } from "sonner"
import { useNavigate } from "@tanstack/react-router"
import { EyeIcon, EyeOffIcon, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useState } from "react"

const formSchema = z.object({
  name: z.string().min(3),
  email: z.email(),
  password: z.string().min(8),
})

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            toast.success("Signup successful")
            navigate({ to: "/login" })
          },
          onError: ({ error }) => {
            toast.error(error?.message as string)
          },
        }
      )
    },
  })

  const isLoading = form.state.isSubmitting

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Signup with your Google account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="flex flex-col"
          >
            <FieldGroup>
              <form.Field
                name="name"
                children={(field) => {
                  const inValid =
                    field.state.meta.isTouched && !field.state.meta.isValid

                  return (
                    <Field>
                      <FieldLabel>Name</FieldLabel>
                      <FieldContent>
                        <Input
                          placeholder="John Doe"
                          type="text"
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          value={field.state.value}
                        />
                      </FieldContent>
                      {inValid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="email"
                children={(field) => {
                  const inValid =
                    field.state.meta.isTouched && !field.state.meta.isValid

                  return (
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <FieldContent>
                        <Input
                          placeholder="john.doe@example.com"
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          value={field.state.value}
                        />
                      </FieldContent>
                      {inValid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="password"
                children={(field) => {
                  const inValid =
                    field.state.meta.isTouched && !field.state.meta.isValid

                  return (
                    <Field>
                      <FieldLabel>Password</FieldLabel>
                      <FieldContent>
                        <div className="relative flex items-center gap-2">
                          <Input
                            placeholder="********"
                            type={showPassword ? "text" : "password"}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            value={field.state.value}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeIcon className="size-4" />
                            ) : (
                              <EyeOffIcon className="size-4" />
                            )}
                          </Button>
                        </div>
                      </FieldContent>
                      {inValid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
              <Field>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Signup"
                  )}
                </Button>
              </Field>
              <Field className="text-center">
                <div>
                  Already have an account?{" "}
                  <a href="/login" className="underline underline-offset-4">
                    Login
                  </a>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <div className="text-center text-xs text-balance text-muted-foreground *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
