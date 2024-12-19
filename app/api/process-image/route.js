import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import SpotifyWebApi from 'spotify-web-api-node';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

function extractJSONFromText(text) {
  try {
    // 尝试直接解析（以防返回的就是纯JSON）
    return JSON.parse(text);
  } catch (e) {
    // 使用正则表达式查找 JSON 数组
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // 如果还是无法解析，尝试更严格的处理
        const songPattern = /"artist"\s*:\s*"([^"]*)"\s*,\s*"title"\s*:\s*"([^"]*)"/g;
        const songs = [];
        let match;
        
        while ((match = songPattern.exec(text)) !== null) {
          songs.push({
            artist: match[1],
            title: match[2]
          });
        }
        
        if (songs.length > 0) {
          return songs;
        }
      }
    }
    
    // 如果上述方法都失败，尝试从文本中提取歌曲信息
    const lines = text.split('\n');
    const songs = [];
    
    for (const line of lines) {
      // 查找包含 "artist" 和 "title" 的行
      const artistMatch = line.match(/"artist":\s*"([^"]*)"/);
      const titleMatch = line.match(/"title":\s*"([^"]*)"/);
      
      if (artistMatch && titleMatch) {
        songs.push({
          artist: artistMatch[1],
          title: titleMatch[1]
        });
      }
    }
    
    return songs;
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No valid session' }), { status: 401 });
    }

    if (session.error === 'RefreshAccessTokenError') {
      return new Response(JSON.stringify({ error: 'Failed to refresh access token' }), { status: 401 });
    }

    const formData = await req.formData();
    const image = formData.get('image');
    
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // Convert image to base64
    const buffer = await image.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');

    // Initialize Gemini Pro Vision
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Analyze image with more specific prompt
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: image.type,
        },
      },
      `Analyze this image and extract song information. Return ONLY a JSON array with 'artist' and 'title' for each song, in this exact format:
      [
        {"artist": "Artist Name", "title": "Song Title"},
        {"artist": "Artist Name", "title": "Song Title"}
      ]
      Only include songs that are clearly visible in the image. Do not include any other text or explanation.`,
    ]);

    const response = await result.response;
    const responseText = response.text();
    console.log('Gemini response:', responseText);
    
    const songs = extractJSONFromText(responseText);
    
    if (!Array.isArray(songs) || songs.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid songs found in the image' }), { status: 400 });
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
    console.error('Error processing image:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }), { status: 500 });
  }
} 