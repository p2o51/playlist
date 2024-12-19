import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import SpotifyWebApi from 'spotify-web-api-node';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No valid session' }), { status: 401 });
    }

    if (session.error === 'RefreshAccessTokenError') {
      return new Response(JSON.stringify({ error: 'Failed to refresh access token' }), { status: 401 });
    }

    const { songs } = await req.json();
    
    if (!Array.isArray(songs) || songs.length === 0) {
      return new Response(JSON.stringify({ error: 'No songs provided' }), { status: 400 });
    }

    // Initialize Spotify API with the session token
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    spotifyApi.setAccessToken(session.accessToken);

    // Create playlist with timestamp
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false });
    const playlist = await spotifyApi.createPlaylist(`AI Playlist - ${timestamp}`, {
      description: 'Playlist created from image using AI',
      public: false,
    });

    // Search and add tracks
    const trackUris = [];
    const failedSongs = [];
    const successSongs = [];
    
    for (const song of songs) {
      try {
        const searchResult = await spotifyApi.searchTracks(
          `track:${song.title} artist:${song.artist}`
        );
        if (searchResult.body.tracks.items.length > 0) {
          const track = searchResult.body.tracks.items[0];
          trackUris.push(track.uri);
          successSongs.push({
            artist: song.artist,
            title: song.title,
            spotifyTitle: track.name,
            spotifyArtist: track.artists[0].name,
          });
        } else {
          failedSongs.push({ ...song, reason: 'Not found on Spotify' });
        }
      } catch (error) {
        failedSongs.push({ ...song, reason: error.message });
      }
    }

    if (trackUris.length > 0) {
      await spotifyApi.addTracksToPlaylist(playlist.body.id, trackUris);
    }

    return new Response(JSON.stringify({
      success: true,
      playlistId: playlist.body.id,
      tracksAdded: trackUris.length,
      totalSongs: songs.length,
      failedSongs: failedSongs,
      successSongs: successSongs,
    }), { status: 200 });

  } catch (error) {
    console.error('Error creating playlist:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }), { status: 500 });
  }
} 