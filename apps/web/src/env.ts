import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    SELF_URL: z.url(),
    AUTH_SECRET: z.string(),
    AUTH_DOMAIN: z.string(),
    POSTGRES_URL: z.url(),
    RESEND_API_KEY: z.string(),
    EMAIL_SENDER_NAME: z.string(),
    EMAIL_SENDER_ADDRESS: z.email(),
    ELECTRIC_URL: z.url(),
    ELECTRIC_SECRET: z.string(),
    AI_GATEWAY_API_KEY: z.string(),
  },
  clientPrefix: "VITE_",
  client: {
    VITE_SELF_URL: z.url(),
  },
  runtimeEnv: {
    SELF_URL: process.env.SELF_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DOMAIN: process.env.AUTH_DOMAIN,
    POSTGRES_URL: process.env.POSTGRES_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME,
    EMAIL_SENDER_ADDRESS: process.env.EMAIL_SENDER_ADDRESS,
    ELECTRIC_URL: process.env.ELECTRIC_URL,
    ELECTRIC_SECRET: process.env.ELECTRIC_SECRET,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,

    // client
    VITE_SELF_URL: import.meta.env.VITE_SELF_URL as string,
  },
})
