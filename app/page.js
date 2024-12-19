'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [result, setResult] = useState(null);
  const [recognizedSongs, setRecognizedSongs] = useState([]);
  const [playlistResult, setPlaylistResult] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setResult(null);
    setRecognizedSongs([]);
    setPlaylistResult(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setResult(data);
        setRecognizedSongs(data.songs);
      } else {
        throw new Error(data.error || 'Failed to process image');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!recognizedSongs.length) return;

    setIsCreatingPlaylist(true);
    try {
      const response = await fetch('/api/create-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ songs: recognizedSongs }),
      });

      const data = await response.json();
      if (response.ok) {
        setPlaylistResult(data);
        const allSongs = [
          ...data.failedSongs.map(song => ({ ...song, status: 'failed' })),
          ...data.successSongs.map(song => ({ ...song, status: 'success' }))
        ];
        setRecognizedSongs(allSongs);
      } else {
        throw new Error(data.error || 'Failed to create playlist');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error.message);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Hero Section */}
      <div className="hero min-h-[40vh] bg-base-100">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold mb-8">Playlist Creator</h1>
            <p className="text-lg mb-8">
              Transform your music images into Spotify playlists with AI
            </p>
            {!session && (
              <button
                onClick={() => signIn('spotify')}
                className="btn btn-primary btn-lg"
              >
                Sign in with Spotify
              </button>
            )}
          </div>
        </div>
      </div>

      {session && (
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-8">
            {/* User Info */}
            <div className="navbar bg-base-100 rounded-box shadow-lg">
              <div className="flex-1">
                <span className="text-lg">Welcome, {session.user?.email}</span>
              </div>
              <div className="flex-none">
                <button onClick={() => signOut()} className="btn btn-ghost btn-sm">
                  Sign out
                </button>
              </div>
            </div>

            {/* Upload Section */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <h2 className="card-title mb-4">Upload Image</h2>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="imageInput"
                  disabled={isLoading || isCreatingPlaylist}
                />
                <label
                  htmlFor="imageInput"
                  className={`btn btn-primary btn-lg ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? 'Processing...' : 'Choose Image'}
                </label>
              </div>
            </div>

            {/* Songs Table */}
            {recognizedSongs.length > 0 && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title mb-4">Recognized Songs</h2>
                  <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr>
                          <th>Artist</th>
                          <th>Title</th>
                          <th>Status</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recognizedSongs.map((song, index) => (
                          <tr key={index}>
                            <td>{song.artist || '-'}</td>
                            <td>{song.title || '-'}</td>
                            <td>
                              {song.status ? (
                                <div className={`badge ${
                                  song.status === 'success' 
                                    ? 'badge-success' 
                                    : 'badge-error'
                                } gap-2`}>
                                  {song.status === 'success' ? 'Added' : 'Failed'}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="text-sm">
                              {song.reason || (song.status === 'success' ? 'Successfully added to playlist' : '-')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!playlistResult && (
                    <div className="card-actions justify-center mt-6">
                      <button
                        onClick={handleCreatePlaylist}
                        disabled={isCreatingPlaylist}
                        className={`btn btn-primary btn-lg ${isCreatingPlaylist ? 'loading' : ''}`}
                      >
                        {isCreatingPlaylist ? 'Creating Playlist...' : 'Create Playlist'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {playlistResult && (
              <div className="alert alert-success shadow-lg">
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-bold">Success!</h3>
                    <div className="text-xs">Added {playlistResult.tracksAdded} tracks to your new playlist.</div>
                  </div>
                </div>
                <div className="flex-none">
                  <a
                    href={`https://open.spotify.com/playlist/${playlistResult.playlistId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-ghost"
                  >
                    Open in Spotify
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
