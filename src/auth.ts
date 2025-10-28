import type { DefaultSession, NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string | null;
    } & DefaultSession['user'];
  }
}

const emailConfigured = Boolean(process.env.EMAIL_SERVER);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      if (user?.id) {
        session.user = { ...session.user, id: user.id };
      }
      return session;
    },
  },
  providers: [
    // Only enable Email if configured to avoid build-time dependencies
    ...(emailConfigured
      ? [EmailProvider({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM })]
      : []),
    CredentialsProvider({
      id: 'memberstack',
      name: 'Memberstack',
      credentials: {
        memberId: { label: 'Member ID', type: 'text' },
      },
      async authorize(credentials) {
        const memberId = (credentials as Record<string, string> | undefined)?.memberId?.trim();
        if (!memberId) return null;
        // L’endpoint SSO crée déjà la session; ce provider n’est utile que si besoin de fallback.
        // On accepte seulement si un utilisateur a été créé pour ce memberId via Account.link ou via email.
        // Recherche par Account providerAccountId si existant, sinon par email dev.
        const account = await prisma.account.findFirst({ where: { provider: 'memberstack', providerAccountId: memberId } });
        if (account) {
          const user = await prisma.user.findUnique({ where: { id: account.userId } });
          return user ? { id: user.id, name: user.name ?? null, email: user.email ?? null } : null;
        }
        return null;
      },
    }),
  ],
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
};

export function auth() {
  return getServerSession(authOptions);
}


