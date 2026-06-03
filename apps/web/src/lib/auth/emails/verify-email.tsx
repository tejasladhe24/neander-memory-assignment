import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Tailwind,
} from "@react-email/components"

interface VerifyEmailProps {
  username: string
  verifyUrl: string
}

const VerifyEmail = (props: VerifyEmailProps) => {
  const { username, verifyUrl } = props
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Body className="bg-gray-100 py-[40px] font-sans">
          <Container className="mx-auto max-w-[600px] rounded-[8px] bg-white p-[32px]">
            <Section>
              <Text className="mt-0 mb-[16px] text-[24px] font-bold text-gray-900">
                Verify your email address
              </Text>

              <Text className="mt-0 mb-[24px] text-[16px] leading-[24px] text-gray-700">
                Thanks {username} for signing up! To complete your registration
                and secure your account, please verify your email address by
                clicking the button below.
              </Text>

              <Section className="mb-[32px] text-center">
                <Button
                  href={verifyUrl}
                  className="box-border rounded-[6px] bg-blue-600 px-[32px] py-[12px] text-[16px] font-medium text-white no-underline"
                >
                  Verify Email Address
                </Button>
              </Section>

              <Text className="mt-0 mb-[24px] text-[14px] leading-[20px] text-gray-600">
                If the button doesn&apos;t work, you can copy and paste this
                link into your browser:
                <br />
                {verifyUrl}
              </Text>

              <Text className="mt-0 mb-[32px] text-[14px] leading-[20px] text-gray-600">
                This verification link will expire in 24 hours. If you
                didn&apos;t create an account, you can safely ignore this email.
              </Text>

              <Hr className="my-[24px] border-gray-200" />

              <Text className="m-0 text-[12px] leading-[16px] text-gray-500">
                Best regards,
                <br />
                The Team
              </Text>
            </Section>

            <Section className="mt-[32px] border-t border-gray-200 pt-[24px]">
              <Text className="m-0 text-center text-[12px] leading-[16px] text-gray-400">
                Company Name
                <br />
                123 Business Street, Suite 100
                <br />
                City, State 12345
              </Text>

              <Text className="m-0 mt-[8px] text-center text-[12px] leading-[16px] text-gray-400">
                <a href="#" className="text-gray-400 underline">
                  Unsubscribe
                </a>{" "}
                | © 2024 Company Name. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default VerifyEmail
