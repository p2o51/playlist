'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [songs, setSongs] = useState([]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setResult(null);
    setSongs([]);

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
        // 合并成功和失败的歌曲列表
        const allSongs = [
          ...data.failedSongs.map(song => ({ ...song, status: 'failed' })),
          ...data.successSongs.map(song => ({ ...song, status: 'success' }))
        ];
        setSongs(allSongs);
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

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Playlist Creator
        </h1>

        {!session ? (
          <div className="text-center">
            <button
              onClick={() => signIn('spotify')}
              className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-green-600 transition"
            >
              Sign in with Spotify
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p>Signed in as {session.user?.email}</p>
              <button
                onClick={() => signOut()}
                className="text-red-500 hover:text-red-600"
              >
                Sign out
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="imageInput"
                disabled={isLoading}
              />
              <label
                htmlFor="imageInput"
                className="cursor-pointer bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition"
              >
                {isLoading ? 'Processing...' : 'Upload Image'}
              </label>
            </div>

            {songs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Artist
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {songs.map((song, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {song.artist || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {song.title || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              song.status === 'success'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {song.status === 'success' ? 'Added' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {song.reason || (song.status === 'success' ? 'Successfully added to playlist' : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result && (
              <div className="bg-green-100 p-4 rounded-lg">
                <p className="text-green-800">
                  Success! Added {result.tracksAdded} tracks to your new playlist.
                </p>
                <a
                  href={`https://open.spotify.com/playlist/${result.playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  Open playlist in Spotify
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
