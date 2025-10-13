import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

const emailConfigured = Boolean(process.env.EMAIL_SERVER);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [
    // Only enable Email if configured to avoid build-time dependencies
    ...(emailConfigured
      ? [EmailProvider({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM })]
      : []),
  ],
  pages: { signIn: '/signin' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}


