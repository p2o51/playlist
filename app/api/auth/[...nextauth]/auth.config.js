import SpotifyProvider from 'next-auth/providers/spotify';

const scopes = [
  'user-read-email',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

export const authOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: {
        params: { scope: scopes }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at * 1000;
      }

      if (token.expiresAt && Date.now() > token.expiresAt) {
        try {
          const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(
                `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
              ).toString('base64')}`,
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken,
            }),
          });

          const tokens = await response.json();

          if (!response.ok) throw tokens;

          return {
            ...token,
            accessToken: tokens.access_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
            refreshToken: tokens.refresh_token ?? token.refreshToken,
          };
        } catch (error) {
          console.error('Error refreshing access token', error);
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.error = token.error;
      session.accessToken = token.accessToken;
      return session;
    },
  },
}; 