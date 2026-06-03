import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db, schema } from "@/lib/db"
import { env } from "@/env"
import { jwt } from "better-auth/plugins"
import { createRemoteJWKSet } from "jose"
import { resend } from "../email"
import ForgotPasswordEmail from "./emails/reset-password"
import VerifyEmail from "./emails/verify-email"
import { isProduction } from "../constants"

export const auth = betterAuth({
  appUrl: env.SELF_URL,
  baseURL: env.SELF_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: `${env.EMAIL_SENDER_NAME} <${env.EMAIL_SENDER_ADDRESS}>`,
        to: user.email,
        subject: "Verify your email",
        react: VerifyEmail({ username: user.name, verifyUrl: url }),
      })
    },
    sendOnSignUp: isProduction,
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: `${process.env.EMAIL_SENDER_NAME} <${process.env.EMAIL_SENDER_ADDRESS}>`,
        to: user.email,
        subject: "Reset your password",
        react: ForgotPasswordEmail({
          username: user.name,
          resetUrl: url,
          userEmail: user.email,
        }),
      })
    },
    requireEmailVerification: isProduction,
  },
  secret: env.AUTH_SECRET,
  plugins: [jwt()],
  advanced: {
    defaultCookieAttributes: {
      domain: env.AUTH_DOMAIN, // <-- important: share across subdomains
      secure: isProduction, // required for HTTPS
      sameSite: "lax", // allow cross-subdomain navigation
      httpOnly: true, // keep it safe from JS access
    },
  },
  trustedOrigins: [env.SELF_URL],
})

function getJWKs() {
  return createRemoteJWKSet(new URL(`${env.SELF_URL}/api/auth/jwks`), {
    cacheMaxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export const jwks = getJWKs()
