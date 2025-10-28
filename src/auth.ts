import type { DefaultSession, NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { fetchMemberstackMember } from '@/lib/memberstack';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string | null;
      memberstackId?: string | null;
    } & DefaultSession['user'];
  }
}

const emailConfigured = Boolean(process.env.EMAIL_SERVER);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      type AugmentedToken = typeof token & { userId?: string; memberstackId?: string | null };
      const augmented = token as AugmentedToken;

      if (user) {
        augmented.userId = user.id;
        augmented.memberstackId = (user as { memberstackId?: string | null }).memberstackId ?? augmented.memberstackId ?? null;
        if (user.email) augmented.email = user.email;
        if (user.name) augmented.name = user.name;
      }

      if (!augmented.memberstackId && augmented.userId) {
        const account = await prisma.account.findFirst({
          where: { userId: augmented.userId, provider: 'memberstack' },
          select: { providerAccountId: true },
        });
        if (account?.providerAccountId) {
          augmented.memberstackId = account.providerAccountId;
        }
      }

      return augmented;
    },
    async session({ session, token }) {
      const augmented = token as { userId?: string; memberstackId?: string | null; email?: string | null; name?: string | null };
      session.user = {
        ...session.user,
        id: augmented.userId ?? null,
        memberstackId: augmented.memberstackId ?? null,
        email: session.user?.email ?? augmented.email ?? null,
        name: session.user?.name ?? augmented.name ?? null,
      };
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
        email: { label: 'Email', type: 'text' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        const input = credentials as Record<string, string | undefined> | undefined;
        const memberId = input?.memberId?.trim();
        if (!memberId) return null;

        const readString = (value: unknown): string | null => {
          if (typeof value !== 'string') return null;
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : null;
        };

        let email: string | null = null;
        let name: string | null = null;

        try {
          const member = await fetchMemberstackMember(memberId);
          email =
            readString(member?.email) ??
            readString((member as { data?: { email?: unknown } | null })?.data?.email) ??
            null;
          name =
            readString((member as { fullName?: unknown }).fullName) ??
            readString((member as { name?: unknown }).name) ??
            readString((member as { data?: { fullName?: unknown; name?: unknown } | null })?.data?.fullName) ??
            readString((member as { data?: { name?: unknown } | null })?.data?.name) ??
            null;
        } catch (error) {
          console.error('[auth] memberstack lookup failed', error);
        }

        email = email ?? readString(input?.email);
        name = name ?? readString(input?.name);

        if (!email) {
          return null;
        }

        const existingAccount = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: 'memberstack', providerAccountId: memberId } },
          select: { userId: true },
        });

        let resolvedUser: { id: string; email: string | null; name: string | null } | null = null;

        if (existingAccount) {
          const currentUser = await prisma.user.findUnique({ where: { id: existingAccount.userId } });
          if (!currentUser) return null;

          let targetEmail = currentUser.email ?? undefined;
          if (email && email !== currentUser.email) {
            const conflict = await prisma.user.findUnique({ where: { email } });
            if (!conflict || conflict.id === currentUser.id) {
              targetEmail = email;
            }
          }

          const updateData: { email?: string; name?: string | null } = {};
          if (targetEmail && targetEmail !== currentUser.email) {
            updateData.email = targetEmail;
          }
          if (typeof name === 'string' && name.trim().length > 0) {
            updateData.name = name;
          }

          const hasUpdates = Object.keys(updateData).length > 0;
          const updated = hasUpdates
            ? await prisma.user.update({
                where: { id: currentUser.id },
                data: updateData,
              })
            : currentUser;
          resolvedUser = {
            id: updated.id,
            email: updated.email ?? currentUser.email ?? null,
            name: updated.name ?? currentUser.name ?? null,
          };
        } else {
          const userByEmail = await prisma.user.findUnique({ where: { email } });
          if (userByEmail) {
            const updateData: { name?: string | null } = {};
            if (typeof name === 'string' && name.trim().length > 0) {
              updateData.name = name;
            }
            const updated = Object.keys(updateData).length > 0
              ? await prisma.user.update({
                  where: { id: userByEmail.id },
                  data: updateData,
                })
              : userByEmail;
            resolvedUser = {
              id: updated.id,
              email: updated.email ?? userByEmail.email ?? null,
              name: updated.name ?? userByEmail.name ?? null,
            };
          } else {
            const created = await prisma.user.create({
              data: { email, name: name ?? undefined },
            });
            resolvedUser = {
              id: created.id,
              email: created.email,
              name: created.name ?? null,
            };
          }
        }

        if (!resolvedUser) return null;

        const userId = resolvedUser.id;

        await prisma.account.upsert({
          where: { provider_providerAccountId: { provider: 'memberstack', providerAccountId: memberId } },
          update: { userId },
          create: {
            userId,
            type: 'oauth',
            provider: 'memberstack',
            providerAccountId: memberId,
          },
        });

        const finalEmail = resolvedUser.email ?? email;
        const finalName = resolvedUser.name ?? name ?? finalEmail ?? null;

        return {
          id: userId,
          email: finalEmail,
          name: finalName,
          memberstackId: memberId,
        };
      },
    }),
  ],
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
};

export function auth() {
  return getServerSession(authOptions);
}
