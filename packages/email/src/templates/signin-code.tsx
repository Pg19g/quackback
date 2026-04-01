import { Heading, Section, Text } from '@react-email/components'
import { EmailLayout, TransactionalFooter } from './email-layout'
import { typography, utils } from './shared-styles'

interface SigninCodeEmailProps {
  code: string
  logoUrl?: string
}

export function SigninCodeEmail({ code, logoUrl }: SigninCodeEmailProps) {
  return (
    <EmailLayout preview={`Your sign-in code is ${code}`} logoUrl={logoUrl}>
      {/* Content */}
      <Heading style={{ ...typography.h1, textAlign: 'center' }}>Your sign-in code</Heading>
      <Text style={{ ...typography.text, textAlign: 'center' }}>
        Enter this code to continue signing in:
      </Text>

      {/* Code Box */}
      <Section style={utils.codeBox}>
        <Text style={utils.code}>{code}</Text>
      </Section>

      <Text style={{ ...typography.textSmall, textAlign: 'center' }}>
        This code expires in 10 minutes.
      </Text>

      {/* Footer */}
      <TransactionalFooter>
        If you didn&apos;t request this code, you can safely ignore this email.
      </TransactionalFooter>
    </EmailLayout>
  )
}
