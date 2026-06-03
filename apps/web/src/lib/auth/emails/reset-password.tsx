import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components"

interface ForgotPasswordEmailProps {
  username: string
  resetUrl: string
  userEmail: string
}

const ForgotPasswordEmail = (props: ForgotPasswordEmailProps) => {
  const { username, resetUrl, userEmail } = props

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Reset your password - Action required</Preview>
        <Body className="bg-gray-100 py-[40px] font-sans">
          <Container className="mx-auto max-w-[600px] rounded-[8px] bg-white p-[40px] shadow-sm">
            {/* Header */}
            <Section className="mb-[32px] text-center">
              <Heading className="m-0 mb-[8px] text-[28px] font-bold text-gray-900">
                Reset Your Password
              </Heading>
              <Text className="m-0 text-[16px] text-gray-600">
                We received a request to reset your password
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="mb-[32px]">
              <Text className="m-0 mb-[16px] text-[16px] leading-[24px] text-gray-700">
                Hello, {username}
              </Text>
              <Text className="m-0 mb-[16px] text-[16px] leading-[24px] text-gray-700">
                We received a password reset request for your account associated
                with <strong>{userEmail}</strong>.
              </Text>
              <Text className="m-0 mb-[24px] text-[16px] leading-[24px] text-gray-700">
                Click the button below to create a new password. This link will
                expire in 24 hours for security reasons.
              </Text>
            </Section>

            {/* Reset Button */}
            <Section className="mb-[32px] text-center">
              <Button
                href={resetUrl}
                className="box-border inline-block rounded-[8px] bg-blue-600 px-[32px] py-[16px] text-[16px] font-semibold text-white no-underline"
              >
                Reset Password
              </Button>
            </Section>

            {/* Alternative Link */}
            <Section className="mb-[32px]">
              <Text className="m-0 mb-[8px] text-[14px] leading-[20px] text-gray-600">
                If the button doesn&apos;t work, copy and paste this link into
                your browser:
              </Text>
              <Link
                href={resetUrl}
                className="text-[14px] break-all text-blue-600"
              >
                {resetUrl}
              </Link>
            </Section>

            {/* Security Notice */}
            <Section className="mb-[32px] rounded-[8px] bg-gray-50 p-[20px]">
              <Text className="m-0 mb-[8px] text-[14px] leading-[20px] font-semibold text-gray-700">
                Security Notice:
              </Text>
              <Text className="m-0 mb-[8px] text-[14px] leading-[20px] text-gray-600">
                • If you didn&apos;t request this password reset, please ignore
                this email
              </Text>
              <Text className="m-0 mb-[8px] text-[14px] leading-[20px] text-gray-600">
                • This link will expire in 24 hours
              </Text>
              <Text className="m-0 text-[14px] leading-[20px] text-gray-600">
                • For security, never share this link with anyone
              </Text>
            </Section>

            {/* Help Section */}
            <Section className="mb-[32px]">
              <Text className="m-0 text-[14px] leading-[20px] text-gray-600">
                Need help? Contact our support team at{" "}
                <Link
                  href="mailto:support@company.com"
                  className="text-blue-600"
                >
                  support@company.com
                </Link>
              </Text>
            </Section>

            {/* Footer */}
            <Section className="border-t border-gray-200 pt-[24px]">
              <Text className="m-0 mb-[8px] text-[12px] leading-[16px] text-gray-500">
                This email was sent to {userEmail}
              </Text>
              <Text className="m-0 mb-[8px] text-[12px] leading-[16px] text-gray-500">
                Company Name, 123 Business Street, City, State 12345
              </Text>
              <Text className="m-0 text-[12px] leading-[16px] text-gray-500">
                © 2025 Company Name. All rights reserved.{" "}
                <Link href="#" className="text-gray-500">
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default ForgotPasswordEmail
