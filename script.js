let allMusicData = [];
let currentSong = new Audio();
let currentPlaylistGradient = null;
let allSongsMap = new Map(); // Central storage for all songs
let isFullScreen = false; // Add global isFullScreen variable
// Add auto-hide functionality
let autoHideTimer = null;
let isControlsVisible = true;
let navTimer;
const NAV_TIMEOUT = 3000; // 3 seconds

// Global variable to store playlist references
let playlistReferences = {
    // Format: "playlistName": ["songId1", "songId2", ...]
    "Hindi Hits": [
        "tum-hi-ho-arjit-singh",
        "channa-mereya-arjit-singh",
        "raabta-arjit-singh"
    ],
    "English Pop": [
        "shape-of-you-ed-sheeran",
        "perfect-ed-sheeran"
    ]
};

// Add this at the top of the file with other global variables
let activePlaylistContext = null; // Store the active playlist context

//Randomly Shuffles an array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}

//Get all songs from all playlists
function getAllSongsFlat(allMusicData) {
    let allSongs = [];
    allMusicData.forEach(group => {
        group.playlists.forEach(playlist => {
            allSongs = allSongs.concat(playlist.songs);
        });
    });
    return allSongs;
}

    // Function to update artwork image and color
    function updateArtworkImage(artworkContainer) {
        const artworkImg = artworkContainer.querySelector('img');
        if (!artworkImg) return;

        // Set error handler before changing src
        artworkImg.onerror = () => {
            console.warn("Error loading artwork image, falling back to default. Attempted src:", artworkImg.src); 
            artworkImg.src = '/Images/Songs/default.jpg';
            artworkContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        };

        if (window.currentSong && window.currentSong.songImage) {
            console.log("updateArtworkImage using window.currentSong:", window.currentSong.songImage, "for element:", artworkImg);
            artworkImg.src = window.currentSong.songImage;
        } else if (window.currentSongData && window.currentSongData.length > 0 && window.currentSongData[0] && window.currentSongData[0].songImage) {
            console.log("updateArtworkImage using window.currentSongData[0]:", window.currentSongData[0].songImage, "for element:", artworkImg);
            artworkImg.src = window.currentSongData[0].songImage;
        } else {
            console.log("updateArtworkImage using default image for element:", artworkImg, "window.currentSong:", window.currentSong, "window.currentSongData:", window.currentSongData);
            artworkImg.src = '/Images/Songs/default.jpg';
        }
        
        const songInfo = document.querySelector('.songInfo');
        const songInfoImg = songInfo.querySelector('img');
        songInfoImg.onload = () => {
            const colorThief = new ColorThief();
            const dominantColor = colorThief.getColor(songInfoImg);
            const hexColor = rgbToHex(dominantColor[0], dominantColor[1], dominantColor[2]);
            artworkContainer.style.backgroundColor = `${hexColor}CC`;
        }

    }

//Play Current Song and update songInfo
async function playMusic(songPath) {
    console.log("playMusic called with songPath:", songPath);
    console.log("currentSong.src before update:", currentSong.src);
    try {
        // If the same song is already playing, just toggle play/pause
        if (currentSong.src === songPath) {
            if (currentSong.paused) {
                await currentSong.play();
            } else {
                currentSong.pause();
            }
            updatePlayPauseIcons();
            updatePlaylistButtonIcons();
            return;
        }

        // If a different song is playing, stop it first
        if (currentSong.src) {
            currentSong.pause();
            currentSong.currentTime = 0;
        }

        // Set new song source
        currentSong.src = songPath;
        
        // Wait for the song to be loaded
        await new Promise((resolve, reject) => {
            currentSong.addEventListener('canplaythrough', resolve, { once: true });
            currentSong.addEventListener('error', reject, { once: true });
        });

        // Play the new song
        await currentSong.play();

        // Find the current song data from the central map
        const songLink = songPath.split('/Songs/')[1];
        let currentSongData = null;

        // First try to find in allSongsMap using songId
        const songId = songLink.split('/').pop().replace('.mp4', '');
        currentSongData = allSongsMap.get(songId);

        // If not found, search in allMusicData
        if (!currentSongData) {
            for (const group of allMusicData) {
                for (const playlist of group.playlists) {
                    const foundSong = playlist.songs.find(song => 
                        song.songLink === songLink || 
                        `/Songs/${song.songLink}` === songPath
                    );
                    if (foundSong) {
                        currentSongData = foundSong;
                        break;
                    }
                }
                if (currentSongData) break;
            }
        }
        

        // If we have currentSongData from window.currentSongData, use its context
        if (window.currentSongData && window.currentSongData.length > 0) {
            const currentContextSong = window.currentSongData.find(song => 
                song.songLink === songLink || 
                `/Songs/${song.songLink}` === songPath
            );
            if (currentContextSong) {
                currentSongData = currentContextSong;
            }
        }

        // Update window.currentSong and artwork
        if (currentSongData) {
            window.currentSong = currentSongData; // Update the global metadata object
            console.log("playMusic updated window.currentSong:", window.currentSong);

            const artworkContainer = document.querySelector('.fullScreenArtwork');
            if (artworkContainer && artworkContainer.style.display === 'block') {
                console.log('Calling updateArtworkImage from playMusic');
                updateArtworkImage(artworkContainer);
            }
        } else {
            console.error("playMusic could not find currentSongData for path:", songPath);
            // If song not found, ensure artwork reflects this (e.g., shows default)
            const artworkContainer = document.querySelector('.fullScreenArtwork');
            if (artworkContainer && artworkContainer.style.display === 'block') {
                // Temporarily clear window.currentSong to force default image in updateArtworkImage
                const previousCurrentSong = window.currentSong;
                window.currentSong = null; 
                console.log('Calling updateArtworkImage with default from playMusic (song not found)');
                updateArtworkImage(artworkContainer);
                window.currentSong = previousCurrentSong; // Restore if necessary
            }
        }

        // Update active playlist context when playing a song
        if (currentSongData && currentSongData.currentGroupLink && currentSongData.currentPlaylistLink) {
            activePlaylistContext = {
                groupLink: currentSongData.currentGroupLink,
                playlistLink: currentSongData.currentPlaylistLink,
                songPath: songPath // Store the song path to track the exact song being played
            };
            console.log('Updated active playlist context:', activePlaylistContext); // Debug log
        }



        // Function to create song info HTML
        function createSongInfoHTML(currentSongData, songLink) {
            console.log("createSongInfoHTML called with currentSongData:", currentSongData);
            console.log("createSongInfoHTML called with songLink:", songLink);

            if (currentSongData) {
                // Create singer links
                const singerLinks = currentSongData.singerNames.split(",").map(singer =>
                    `<a href="#" class="hoverUnderline">${singer.trim()}</a>`
                ).join(", ");

                return `
                    <img src="${currentSongData.songImage}" onerror="this.src='/Images/Songs/default.jpg'">
                    <div class="mainInfo">
                        <strong><a href="#" class="hoverUnderline">${currentSongData.songName}</a></strong>
                        <span>${singerLinks}</span>
                    </div>
                `;
            } else {
                // If song data not found, try to extract from path
                const fileName = songLink.split('/').pop();
                const songName = decodeURIComponent(fileName.split('[')[0]);
                const singerMatch = fileName.match(/\[(.*?)\]/);
                const singerNames = singerMatch ? decodeURIComponent(singerMatch[1]) : "";

                // Create singer links
                const singerLinks = singerNames.split(",").map(singer =>
                    `<a href="#" class="hoverUnderline">${singer.trim()}</a>`
                ).join(", ");

                return `
                    <img src="/Images/Songs/default.jpg">
                    <div class="mainInfo">
                        <strong><a href="#" class="hoverUnderline">${songName}</a></strong>
                        <span>${singerLinks}</span>
                    </div>
                `;
            }
        }

        // Update Song Info in webpage
        const songInfo = document.querySelector(".songInfo");
        if (songInfo) {
            songInfo.innerHTML = createSongInfoHTML(currentSongData, songLink);
        };
        
        



 

        // Update sidebar playlist button only if we have context
        if (currentSongData?.currentGroupLink && currentSongData?.currentPlaylistLink) {
            const sideBarPlaylistButton = document.querySelector(".sideBar .playingPlaylistButton");
            const sideBarPlaylistButtonImg = sideBarPlaylistButton?.querySelector("img");
            if (sideBarPlaylistButton && sideBarPlaylistButtonImg) {
                sideBarPlaylistButton.style.display = "flex";
                sideBarPlaylistButtonImg.src = currentSongData.currentPlaylistImage;
                sideBarPlaylistButton.dataset.groupLink = currentSongData.currentGroupLink;
                sideBarPlaylistButton.dataset.playlistLink = currentSongData.currentPlaylistLink;
            }
        } else {
                // Hide sidebar playlist button if no context
                const sideBarPlaylistButton = document.querySelector(".sideBar .playingPlaylistButton");
                if (sideBarPlaylistButton) {
                    sideBarPlaylistButton.style.display = "none";
                    delete sideBarPlaylistButton.dataset.groupLink;
                    delete sideBarPlaylistButton.dataset.playlistLink;
            }
        }

        // Update all play/pause icons
        updatePlayPauseIcons();
        updatePlaylistButtonIcons();
    } catch (error) {
        console.error("Error playing song:", error);
        // If there's an error, try to recover
        if (currentSong.src === songPath) {
            try {
                await currentSong.play();
            } catch (retryError) {
                console.error("Failed to recover from play error:", retryError);
            }
        }
    }

    // Update the active filter button color after setting currentSong
    updateActiveFilterButtonColor();
}

// Fetch Data from Folders
async function getGroups() {
    try {
        // Use current window location instead of hardcoded port
        let baseUrl = "https://media.githubusercontent.com/media/Omkar3101/Waivy_Project/refs/heads/main";
        let res = await fetch(`${baseUrl}/Songs`);
    let html = await res.text();
    let div = document.createElement("div");
    div.innerHTML = html;
    let links = Array.from(div.getElementsByTagName("a"));
    let groupLinks = [];
    links.forEach(ele => {
        if (ele.href.includes("Songs")) {
            let group = ele.href.split("/Songs/")[1].replace(/\/$/, "");
            if (group) groupLinks.push(group);
        }
    });
    return groupLinks;
    } catch (error) {
        console.error("Error fetching groups:", error);
        return [];
    }
}

async function getPlaylists(groupLink) {
    try {
        let baseUrl = "https://media.githubusercontent.com/media/Omkar3101/Waivy_Project/refs/heads/main";
        let response = await fetch(`${baseUrl}/Songs/${groupLink}`);
    let html = await response.text();
    let div = document.createElement("div");
    div.innerHTML = html;
    let links = Array.from(div.getElementsByTagName("a"));
    let playlistLinks = [];
    links.forEach(element => {
        if (element.href.includes("Songs")) {
            let parts = element.href.split(`/Songs/${groupLink}/`);
            if (parts.length === 2) {
                let playlist = parts[1].replace(/\/$/, "");
                if (playlist) playlistLinks.push(playlist);
            }
        }
    });
    return playlistLinks;
    } catch (error) {
        console.error("Error fetching playlists:", error);
        return [];
    }
}

async function getSongs(groupLink, playlistLink) {
    try {
        let baseUrl = "https://media.githubusercontent.com/media/Omkar3101/Waivy_Project/refs/heads/main";
        let url = `${baseUrl}/Songs/${groupLink.replace(/\/$/, "")}/${playlistLink.replace(/^\//, "")}`;
    let res = await fetch(url);
    let html = await res.text();
    let div = document.createElement("div");
    div.innerHTML = html;
    let links = Array.from(div.getElementsByTagName("a"));
    let songLinks = [];
    links.forEach(element => {
        if (element.href.includes("Songs")) {
            let song = element.href.split("/Songs/")[1];
            if (song) songLinks.push(song);
        }
    });
    return songLinks;
    } catch (error) {
        console.error("Error fetching songs:", error);
        return [];
    }
}

// Add function to generate unique song ID
function generateSongId(songName, singerNames) {
    // Create a unique ID by combining song name and first singer
    const firstSinger = singerNames.split(',')[0].trim();
    const baseId = `${songName}-${firstSinger}`;
    // Convert to lowercase and replace spaces with hyphens
    return baseId.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}


// Helper function to create a new group
function createGroup(groupName) {
    // Convert group name to a valid link format
    const groupLink = groupName.toLowerCase().replace(/\s+/g, '-');
    
    return {
        groupLink,
        groupName,
        playlists: []
    };
}

// Helper function to create a new playlist
function createPlaylist(playlistName, groupName) {
    // Convert playlist name and group name to valid link formats
    const playlistLink = playlistName.toLowerCase().replace(/\s+/g, '-');
    const groupLink = groupName.toLowerCase().replace(/\s+/g, '-');
    
    return {
        playlistLink,
        playlistName,
        playlistImage: `/Images/Playlists/${groupName}/${playlistName}.jpg`,
        songs: [],
        groupName: groupName,  // Store the group name for reference
        groupLink: groupLink   // Store the group link for reference
    };
}

// Helper function to add a playlist to a group
function addPlaylistToGroup(group, playlist) {
    if (!group.playlists) {
        group.playlists = [];
    }
    
    // Check if playlist already exists in the group
    const existingPlaylist = group.playlists.find(p => p.playlistName === playlist.playlistName);
    if (!existingPlaylist) {
        group.playlists.push(playlist);
        console.log(`Added playlist "${playlist.playlistName}" to group "${group.groupName}"`);
    } else {
        console.log(`Playlist "${playlist.playlistName}" already exists in group "${group.groupName}"`);
    }
    return group;
}

// Helper function to create a group with playlists
function createGroupWithPlaylists(groupName, playlistNames) {
    const group = createGroup(groupName);
    
    playlistNames.forEach(playlistName => {
        const playlist = createPlaylist(playlistName, groupName);
        addPlaylistToGroup(group, playlist);
    });
    
    return group;
}

// Modify createPlaylistReferences to use the global playlistReferences
function createPlaylistReferences() {
    return playlistReferences;
}

// Modify addSongToPlaylist to update both playlistReferences and allMusicData
function addSongToPlaylist(playlistName, songName, singerNames) {
    const songId = generateSongId(songName, singerNames);
    
    // Update playlistReferences
    if (!playlistReferences[playlistName]) {
        playlistReferences[playlistName] = [];
    }
    if (!playlistReferences[playlistName].includes(songId)) {
        playlistReferences[playlistName].push(songId);
        console.log(`Added song "${songName}" to playlist "${playlistName}"`);
    } else {
        console.log(`Song "${songName}" already exists in playlist "${playlistName}"`);
        return;
    }

    // Find the song in allSongsMap
    const songData = allSongsMap.get(songId);
    if (!songData) {
        console.log(`Song "${songName}" not found in allSongsMap`);
        return;
    }

    // Update allMusicData
    for (const group of allMusicData) {
        for (const playlist of group.playlists) {
            if (playlist.playlistName === playlistName) {
                // Check if song already exists in playlist
                const songExists = playlist.songs.some(s => s.songId === songId);
                if (!songExists) {
                    playlist.songs.push(songData);
                    console.log(`Added song to playlist in allMusicData`);
                    
                    // Re-render the playlist if it's currently being displayed
                    const playlistContainer = document.querySelector('.playingPlaylistContainer');
                    if (playlistContainer && playlistContainer.style.display === 'flex') {
                        const currentPlaylist = playlist;
                        renderPlaylistSongs(currentPlaylist, playlistContainer);
                    }
                }
                return;
            }
        }
    }
    console.log(`Playlist "${playlistName}" not found in allMusicData`);
}

// Modify removeSongFromPlaylist to update the global playlistReferences
function removeSongFromPlaylist(playlistName, songName, singerNames) {
    const songId = generateSongId(songName, singerNames);
    
    if (playlistReferences[playlistName]) {
        playlistReferences[playlistName] = playlistReferences[playlistName]
            .filter(id => id !== songId);
        console.log(`Removed song "${songName}" from playlist "${playlistName}"`);
    }
    return playlistReferences;
}

// Add helper function to get song ID from song data
function getSongId(songData) {
    return generateSongId(songData.songName, songData.singerNames);
}

// Modify getAllMusicData to only handle server data
async function getAllMusicData() {
    try {
        let groups = [];
        let groupLinks = await getGroups();
        const playlistReferences = createPlaylistReferences();

        // First, find and process the "All Songs" group to build our song map
        const allSongsGroupLink = groupLinks.find(link => decodeURIComponent(link) === "All Songs");
        if (allSongsGroupLink) {
            const playlists = await getPlaylists(allSongsGroupLink);
            const hiddenAllSongsPlaylist = playlists.find(playlist => decodeURIComponent(playlist) === "Hidden All Songs");
            
            if (hiddenAllSongsPlaylist) {
                const songLinks = await getSongs(allSongsGroupLink, hiddenAllSongsPlaylist);
                let songs = [];
                
                // Process all songs and store them in the central map
                for (const songLink of songLinks) {
                    let fileName = songLink.split("/").pop();
                    let songName = decodeURIComponent(fileName.split("[")[0]);
                    let singerMatch = fileName.match(/\[(.*?)\]/);
                    let singerNames = singerMatch ? decodeURIComponent(singerMatch[1]) : "";
                    let songImage = `/Images/Songs/${songName.trim()}.jpg`;

                    // Generate unique song ID
                    const songId = generateSongId(songName, singerNames);

                    const songData = {
                        songId,
                        songLink,
                        songName,
                        singerNames,
                        songImage,
                        groupLink: allSongsGroupLink,
                        playlistLink: hiddenAllSongsPlaylist
                    };

                    // Store in central map using songId as key
                    allSongsMap.set(songId, songData);
                    songs.push(songData);
                }

                // Add the "All Songs" group with its playlists
                groups.push({
                    groupLink: allSongsGroupLink,
                    groupName: "All Songs",
                    playlists: [{
                        playlistLink: hiddenAllSongsPlaylist,
                        playlistName: "Hidden All Songs",
                        playlistImage: "/Images/Playlists/default.jpg",
                        songs: songs
                    }]
                });
            }
        }

        // Now process other groups and playlists from the server
        for (const groupLink of groupLinks) {
            // Skip the "All Songs" group as we've already processed it
            if (decodeURIComponent(groupLink) === "All Songs") continue;

            let playlists = [];
            let playlistLinks = await getPlaylists(groupLink);

            for (const playlistLink of playlistLinks) {
                const playlistName = decodeURIComponent(playlistLink);
                let playlistImage = `/Images/Playlists/${playlistName}.jpg`;
                let songs = [];

                // Get song references for this playlist
                const songReferences = playlistReferences[playlistName] || [];
                
                // Add songs from references
                for (const songId of songReferences) {
                    const songData = allSongsMap.get(songId);
                    if (songData) {
                        songs.push(songData);
                    }
                }

                playlists.push({
                    playlistLink,
                    playlistName,
                    playlistImage,
                    songs
                });
            }

            groups.push({
                groupLink,
                groupName: decodeURIComponent(groupLink),
                playlists
            });
        }

        return groups;
    } catch (error) {
        console.error("Error fetching all music data:", error);
        return [];
    }
}


// Render all groups and Playlists
function renderGroups(groups) {
    const cardContainerGroups = document.querySelector(".cardContainerGroups");
    if (!cardContainerGroups) return;

    // Clear existing content
    cardContainerGroups.innerHTML = "";

    // Filter out the "All Songs" group
    const filteredGroups = groups.filter(group => group.groupName !== "All Songs");

    filteredGroups.forEach(group => {
        // Create group container
        const groupContainer = document.createElement("div");
        groupContainer.className = "groupContainer";

        // Create group heading
        const headingContainer = document.createElement("div");
        headingContainer.className = "headingContainer flex";
        headingContainer.innerHTML = `
            <a href="#" class="hoverUnderline">${group.groupName}</a>
            <a href="#" class="hoverUnderline">Show all</a>
        `;

        // Create card container for playlists
        const cardContainer = document.createElement("div");
        cardContainer.className = "cardContainer";

        // Add playlists to card container
        group.playlists.forEach(playlist => {
            const card = document.createElement("div");
            const isArtistGroup = group.groupName === "Popular artist";
            const coverImageClass = isArtistGroup ? "coverImage artistCover" : 
            "coverImage";
            const cardClass = isArtistGroup ? "card artistCard" : "card";

            card.className = cardClass;
            card.setAttribute("data-group-link", group.groupLink);
            card.setAttribute("data-playlist-link", playlist.playlistLink);

            card.innerHTML = `
                <div class="${coverImageClass}">
                    <img src="${playlist.playlistImage}" onerror="this.src='/Images/Playlists/default.jpg'" alt="${playlist.playlistName}">
                </div>
                <div class="cardContent">
                    <p class="playlistName hoverUnderline">${playlist.playlistName}</p>
                    ${isArtistGroup ? '<p class="artistLabel">Artist</p>' : `<p class="playlistSingers hoverUnderline">${playlist.songs.map(song => song.singerNames).filter(name => name).join(", ")}</p>`}
                </div>
                <div class="greenPlayButton playlistButton">
                    <img src="/Images/play.svg" alt="play">
                </div>
            `;

            cardContainer.appendChild(card);
        });

        // Add heading and cards to group container
        groupContainer.appendChild(headingContainer);
        groupContainer.appendChild(cardContainer);

        // Add group container to main container
        cardContainerGroups.appendChild(groupContainer);
    });

    // Reattach playlist button events after rendering
    setTimeout(() => {
        attachPlaylistButtonEvents();
    }, 0);
    
    // Reattach playlist card click events
    renderSongsFromPlaylist(allMusicData);

    // Add hover events to cards only for non-mobile screens
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            // Check if not in mobile view (window width > 768px)
            if (window.innerWidth > 768) {
                const playlistImage = card.querySelector('.coverImage img');
                if (playlistImage) {
                    updateCenterContainerGradient(playlistImage.src);
                }
            }
        });

        card.addEventListener('mouseleave', () => {
            // Check if not in mobile view (window width > 768px)
            if (window.innerWidth > 768) {
                // Restore the current playlist gradient if a song is playing
                if (currentPlaylistGradient) {
                    updateCenterContainerGradient(currentPlaylistGradient);
                } else {
                    // Reset to default gradient if no song is playing
                    const centerContainer = document.querySelector('.centerContainer');
                    if (centerContainer) {
                        centerContainer.style.background = 'linear-gradient(to bottom, rgba(18, 18, 18, 0.9) 0%, color-mix(in srgb, rgba(18, 18, 18, 0.9) 30%, var(--tertiary-color) 70%) 15%, var(--tertiary-color) 25%, var(--tertiary-color) 100%)';
                    }
                }
            }
        });
    });
}

// Helper function to convert RGB to Hex
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Helper function to create a darker shade of a color
function darkenColor(hex, percent = 30) {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Darken each component
    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));

    // Convert back to hex
    return rgbToHex(r, g, b);
}

// Helper function to apply gradient to leftContainer
async function applyPlaylistGradient(playlistImageUrl) {
    try {
        // Create a new image element
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Enable CORS
        
        // Create a promise to handle image loading
        const imageLoadPromise = new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Set the image source
        img.src = playlistImageUrl;

        // Wait for the image to load
        await imageLoadPromise;

        // Create a new ColorThief instance
        const colorThief = new ColorThief();
        
        // Get the dominant color
        const [r, g, b] = colorThief.getColor(img);
        
        // Calculate color brightness (0-255)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // Normalize the color to a medium brightness
        let normalizedR = r, normalizedG = g, normalizedB = b;
        
        if (brightness < 100) {
            // If too dark, lighten it
            normalizedR = Math.min(r + 50, 255);
            normalizedG = Math.min(g + 50, 255);
            normalizedB = Math.min(b + 50, 255);
        } else if (brightness > 200) {
            // If too light, darken it
            normalizedR = Math.max(r - 50, 0);
            normalizedG = Math.max(g - 50, 0);
            normalizedB = Math.max(b - 50, 0);
        }
        
        // Create gradient that transitions to the tertiary color within the top 25%
        const gradient = `linear-gradient(to bottom, 
            rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) -40%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 60%, var(--tertiary-color) 40%) -25%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 50%, var(--tertiary-color) 50%) -15%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 40%, var(--tertiary-color) 60%) -5%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 30%, var(--tertiary-color) 70%) 5%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 25%, var(--tertiary-color) 75%) 15%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 20%, var(--tertiary-color) 80%) 25%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 15%, var(--tertiary-color) 85%) 35%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 10%, var(--tertiary-color) 90%) 40%,
            color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 5%, var(--tertiary-color) 95%) 45%,
            var(--tertiary-color) 50%,
            var(--tertiary-color) 100%
        )`;
        
        // Apply the gradient to the entire playlist container
        const playlistContainer = document.querySelector('.playingPlaylistContainer');
        if (playlistContainer) {
            playlistContainer.style.background = gradient;
            playlistContainer.style.transition = 'background 0.5s ease';
        }

        
        // Store the dominant color in the CSS variable
        document.documentElement.style.setProperty('--active-song-color', `rgb(${normalizedR}, ${normalizedG}, ${normalizedB})`);
    } catch (error) {
        console.error('Error applying playlist gradient:', error);
        // Fallback to default gradient if there's an error
        const playlistContainer = document.querySelector('.playingPlaylistContainer');
        if (playlistContainer) {
            playlistContainer.style.background = 'linear-gradient(to bottom, rgba(18, 18, 18, 0.9) 0%, color-mix(in srgb, rgba(18, 18, 18, 0.9) 30%, var(--tertiary-color) 70%) 15%, var(--tertiary-color) 25%, var(--tertiary-color) 100%)';
        }
    }
}

// Helper function to render songs in a playlist
function renderPlaylistSongs(playlist, playlistContainer, playlistTitle = null, playlistDescription = null) {
    // Show playlist container
    if (playlistContainer) {
        playlistContainer.style.display = "flex";
    }

    // Check if this is an artist playlist
    const isArtistPlaylist = playlistDescription === "Artist";

    // Update playlist info
    playlistContainer.innerHTML = `
        <div class="playlistInfo">
        <div class="collapse" style="display:block; z-index:111;">
                <img src="${window.innerWidth <= 768 ? '/Images/lessUp.svg' : '/Images/openCollapse.svg'}">
            </div>
            <div class="InfoMain flex">
                <div class="playlistImage ${isArtistPlaylist ? 'artistImage' : ''}">
                    <img src="${playlist.playlistImage}" alt="${playlist.playlistName}" onerror="this.src='/Images/Playlists/default.jpg'">
                </div>
                <div class="playlistMainInfo">
                    <div class="playlistName">
                        <h1>${playlistTitle || playlist.playlistName}</h1>
                    </div>
                    <div class="playlistDescription">
                        ${isArtistPlaylist ? 
                            `<div class="verifiedArtist flex">
                                <img src="/Images/verified.svg" alt="verified" class="verifiedIcon">
                                <p>Verified Artist</p>
                            </div>` 
                            : `<p>${playlistDescription || `${playlist.songs.length} songs`}</p>`
                        }
                    </div>
                </div>
            </div>
        </div>
        <div class="songList">
            <ul></ul>
        </div>
    `;

    // Apply gradient based on playlist image
    applyPlaylistGradient(playlist.playlistImage);

    // Inject playlist context into each song
    const resolvedSongs = playlist.songs.map(song => {
        // Get the original song from allSongsMap using songId
        const originalSong = allSongsMap.get(song.songId);
        if (!originalSong) return null;

        // Create a new song object with injected playlist context
        return {
            ...originalSong,
            currentGroupLink: playlist.groupLink,
            currentGroupName: playlist.groupName,
            currentPlaylistLink: playlist.playlistLink,
            currentPlaylistName: playlist.playlistName,
            currentPlaylistImage: playlist.playlistImage
        };
    }).filter(Boolean);

    // Store the resolved songs with context
    window.currentSongData = resolvedSongs;

    // Render songs using the resolved songs with context
    const songList = playlistContainer.querySelector(".songList ul");
    songList.innerHTML = ""; // Clear existing songs

    resolvedSongs.forEach((song, i) => {
        // Create singer links
        const singerLinks = song.singerNames.split(",").map(singer => {
            const trimmedSinger = singer.trim();
            return `<a href="#" class="hoverUnderline">${trimmedSinger}</a>`;
        }).join(", ");

        // Determine initial play/pause icon based on current playback state
        const isCurrentlyPlaying = currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`);
        const playPauseIconSrc = isCurrentlyPlaying
            ? (currentSong.paused ? "/Images/playWhite.svg" : "/Images/pauseWhite.svg")
            : "/Images/playWhite.svg";

        // Add song to list
        songList.innerHTML += `
            <li class="flex songLi ${isCurrentlyPlaying ? 'active' : ''}" data-song="/Songs/${song.songLink}">
                <div class="serialPlay" style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
                    <span class="serial" style="position:absolute; left:0; center:0; top:0; bottom:0; display:flex; align-items:center; justify-content:center;">
                        ${i + 1}
                    </span>
                    <div class="equalizer">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <button class="songButton" style="position:absolute; left:0; center:0; top:0; bottom:0; display:flex; align-items:center; justify-content:center; background:none; border:none; cursor:pointer;">
                        <img class="playImg" src="${playPauseIconSrc}" style="width:15px; height:15px;">
                    </button>
                </div>
                <img src="${song.songImage}" alt="${song.songName}" class="songCover" height="40px" style="margin-center:10px;" onerror="this.src='/Images/Songs/default.jpg'">
                <div class="info">
                    <p><a href="#" class="hoverUnderline">${song.songName}</a></p>
                    <p>${singerLinks}</p>
                </div>
            </li>`;
    });

    // Attach click event in songLi
    songList.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
            const songPath = li.getAttribute("data-song");
            if (!songPath) return;
            playMusic(songPath);
        });
    });

    // Attach song button events
    attachSongButtonEvents();

    // Update icons after rendering the new song list
    updatePlayPauseIcons();

    // Attach collapse button event
    const collapseButton = playlistContainer.querySelector('.collapse');
    if (collapseButton) {
        collapseButton.addEventListener('click', () => {
            const sideBar = document.querySelector('.sideBar');
            const centerContainer = document.querySelector('.centerContainer');

            if (playlistContainer && sideBar && centerContainer) {
                // Hide playlist container
                playlistContainer.style.display = 'none';
                
                // Show sidebar with full visibility in desktop view
                if (window.innerWidth > 768) {
                    sideBar.style.display = 'flex';
                    sideBar.style.opacity = '1';
                    sideBar.style.visibility = 'visible';
                }
                
                // Adjust center container 
                if (window.innerWidth <= 768) {
                    const header = document.querySelector('.headerContainer2');
                    if (header) {
                        header.style.transform = 'translateY(0)';
                        header.style.transition = 'transform 0.3s ease';
                    }
                    centerContainer.style.transform = 'translateX(0)';
                    playlistContainer.style.transform = 'translateX(100%)';
                } else {
                    centerContainer.style.width = 'calc(100vw - 16px - 5vw)';
                }
            }
        });
    }

    // Reattach sidebar events to maintain button functionality
    attachSidebarEvents();
}

// Render songs from playlist
function renderSongsFromPlaylist(allMusicData) {
    // Hide leftContainer initially
    const leftContainer = document.querySelector(".playingPlaylistContainer");
    const sideBar = document.querySelector(".sideBar");
    const libraryContainer = document.querySelector(".libraryContainer");
    if (leftContainer) {
        leftContainer.style.display = "none";
    }
    if (sideBar) {
        sideBar.style.display = "flex";
    }
    if (libraryContainer) {
        libraryContainer.style.display = "none";
    }


    // Add click event to all playlist cards
    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", function (e) {
            // Don't trigger if play button is clicked
            if (e.target.closest(".playlistButton")) return;

            const groupLink = this.getAttribute("data-group-link");
            const playlistLink = this.getAttribute("data-playlist-link");
            const header = document.querySelector('.headerContainer2');

            if (header) {
                header.style.transform = 'translateY(-100%)';
                header.style.transition = 'transform 0.3s ease';
            }

            if (sideBar) {
                sideBar.style.display = 'none';
            }

            // Find the playlist data
            const group = allMusicData.find(g => g.groupLink === groupLink);
            if (!group) return;

            const playlist = group.playlists.find(p => p.playlistLink === playlistLink);
            if (!playlist) return;

            // Don't update activePlaylistContext when just viewing a playlist
            // Only update it when actually playing a song from that playlist
            
            const playlistContainer = document.querySelector(".playingPlaylistContainer");
            if (playlistContainer) {
                playlistContainer.classList.add('active');
    // Add overlay
    const overlay = document.querySelector('.playlist-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
    
    // Render playlist content
                renderPlaylistSongs(playlist, playlistContainer);
}
        });
    });
}

//Fucntionality of Play Buttons

//1. PlayBar Button
function attachPlayBarButtonEvents() {
    const playBarButton = document.querySelector(".playBarButton");
    if (!playBarButton) return;

    playBarButton.addEventListener("click", async () => {
        if (currentSong.src) {
            try {
                console.log('PlayBar button clicked. Current state:', {
                    isPaused: currentSong.paused,
                    isFullScreen,
                    currentSongSrc: currentSong.src
                });

        if (currentSong.paused) {
                    // If in full screen, ensure video is synced and ready
                    if (isFullScreen) {
                const fullScreenVideo = document.getElementById('fullScreenVideo');
                        console.log('Fullscreen video element:', fullScreenVideo);
                        
                        if (fullScreenVideo) {
                            // Ensure video is at the same time as audio
                    fullScreenVideo.currentTime = currentSong.currentTime;
                            
                            // Play both audio and video together
                            try {
                                await Promise.all([
                                    currentSong.play(),
                                    fullScreenVideo.play()
                                ]);
                                console.log('Successfully started playback of both audio and video');
                            } catch (error) {
                                console.error('Error playing media:', error);
                                // If video fails, still try to play audio
                                await currentSong.play();
                }
            } else {
                            console.log('No fullscreen video element found, playing audio only');
                            await currentSong.play();
                        }
                    } else {
                        console.log('Not in fullscreen mode, playing audio only');
                        await currentSong.play();
                    }
                } else {
                    console.log('Pausing playback');
                    // Pause both audio and video
                currentSong.pause();
                    if (isFullScreen) {
                        const fullScreenVideo = document.getElementById('fullScreenVideo');
                        if (fullScreenVideo) {
                            console.log('Pausing fullscreen video');
                            // Force video to pause
                            fullScreenVideo.pause();
                            // Additional check to ensure video is paused
                            if (!fullScreenVideo.paused) {
                                console.log('Video not paused, trying alternative pause method');
                                fullScreenVideo.currentTime = fullScreenVideo.currentTime;
                                fullScreenVideo.pause();
                            }
                        } else {
                            console.log('No fullscreen video element found while trying to pause');
                        }
                    }
            }
            // Update all play/pause icons
            updatePlayPauseIcons();
            } catch (error) {
                console.error('Error in playBar button:', error);
                // Try to recover by ensuring audio state is correct
                if (currentSong.paused) {
                    try {
                        await currentSong.play();
                    } catch (retryError) {
                        console.error('Failed to recover playback:', retryError);
                    }
                }
            }
        }
    });
}

//2. Song Buttons
function attachSongButtonEvents() {
    // Remove any existing event listeners first
    document.querySelectorAll(".songButton").forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    // Attach new event listeners
    document.querySelectorAll(".songButton").forEach(button => {
        button.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent list item click event

            const li = button.closest("li");
            if (!li) return;

            const songPath = li.getAttribute("data-song");
            if (!songPath) return;

            // Get the current playlist context
            const playlistContainer = document.querySelector(".playingPlaylistContainer");
            if (playlistContainer) {
                const groupLink = playlistContainer.getAttribute("data-group-link");
                const playlistLink = playlistContainer.getAttribute("data-playlist-link");
                
                if (groupLink && playlistLink) {
                    // Find the group and playlist
                    const group = allMusicData.find(g => g.groupLink === groupLink);
                    if (group) {
                        const playlist = group.playlists.find(p => p.playlistLink === playlistLink);
                        if (playlist) {
                            // Find the song in the playlist
                            const song = playlist.songs.find(s => `/Songs/${s.songLink}` === songPath);
                            if (song) {
                                // Create song data with context
                                window.currentSongData = [{
                                    ...song,
                                    currentGroupLink: groupLink,
                                    currentGroupName: group.groupName,
                                    currentPlaylistLink: playlistLink,
                                    currentPlaylistName: playlist.playlistName,
                                    currentPlaylistImage: playlist.playlistImage
                                }];

                                // Update active playlist context
                                activePlaylistContext = {
                                    groupLink: groupLink,
                                    playlistLink: playlistLink,
                                    songPath: songPath
                                };
                                console.log('Updated active playlist context from song button:', activePlaylistContext);
                            }
                        }
                    }
                }
            }

            // If this song is already playing
            if (currentSong.src && currentSong.src.includes(songPath)) {
                if (currentSong.paused) {
                    await currentSong.play();
                } else {
                    currentSong.pause();
                }
            } else {
                // Play new song
                await playMusic(songPath);
            }

            // Update all play/pause icons
            updatePlayPauseIcons();
        });
    });
}

//3. Playlist Buttons
function attachPlaylistButtonEvents() {
    // Remove any existing event listeners first
    document.querySelectorAll(".playlistButton").forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    // Attach new event listeners
    document.querySelectorAll(".playlistButton").forEach(button => {
        button.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent card click event

            const card = button.closest(".card");
            if (!card) return;

            const groupLink = card.getAttribute("data-group-link");
            const playlistLink = card.getAttribute("data-playlist-link");
            if (!groupLink || !playlistLink) return;

            // Find the playlist data
            const group = allMusicData.find(g => g.groupLink === groupLink);
            if (!group) return;

            const playlist = group.playlists.find(p => p.playlistLink === playlistLink);
            if (!playlist) return;

            // Find the currently playing song data from the clicked playlist
            const currentlyPlayingSongInClickedPlaylist = playlist.songs.find(song =>
                currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
            );

            if (currentlyPlayingSongInClickedPlaylist) {
                // Update active playlist context to the clicked playlist
                activePlaylistContext = {
                    groupLink: groupLink,
                    playlistLink: playlistLink,
                    songPath: currentSong.src
                };
                console.log('Updated active playlist context from playlist button:', activePlaylistContext);

                // Toggle play/pause
                    if (currentSong.paused) {
                    currentSong.play();
                    } else {
                        currentSong.pause();
                }

                // Update the button icon
                button.src = currentSong.paused ? "/Images/play.svg" : "/Images/pause.svg";
            } else {
                // If no song is playing from this playlist, play the first song
                if (playlist.songs.length > 0) {
                const firstSong = playlist.songs[0];
                    const songPath = `/Songs/${firstSong.songLink}`;
                    
                    // Update active playlist context to the clicked playlist
                    activePlaylistContext = {
                        groupLink: groupLink,
                        playlistLink: playlistLink,
                        songPath: songPath
                    };
                    console.log('Updated active playlist context from playlist button:', activePlaylistContext);
                    
                    await playMusic(songPath);
                }
            }

            // Update all play/pause icons
            updatePlayPauseIcons();
        });
    });
}

//4. Updating Play Pause Icons
function updatePlayPauseIcons() {
    try {
        // Get all song list items in the currently displayed playlist
        const songListItems = document.querySelectorAll(".playingPlaylistContainer .songList ul li");
        // Get playbar button
        const playBarButton = document.querySelector(".playBarButton img");
        // Get all playlist buttons
        const playlistButtons = document.querySelectorAll(".playlistButton img");
        // Get sidebar playlist button
        const sideBarPlaylistButton = document.querySelector(".sideBar .playingPlaylistButton img");
        const sideBarPlaylistButtonContainer = document.querySelector(".sideBar .playingPlaylistButton");

        // First, remove 'playing' class from all cards
        document.querySelectorAll('.card').forEach(card => {
            card.classList.remove('playing');
        });

        // Update song list items
        songListItems.forEach(li => {
            const songPath = li.getAttribute("data-song");
            const serialElement = li.querySelector(".serial");
            const equalizerElement = li.querySelector(".equalizer");
            const playPauseIcon = li.querySelector(".songButton img");

            if (currentSong.src && songPath && currentSong.src.includes(songPath)) {
                // Add 'active' class to the currently playing song
                li.classList.add("active");

                if (currentSong.paused) {
                    // If paused, show serial, hide equalizer
                    if (serialElement) serialElement.style.display = "flex";
                    if (equalizerElement) equalizerElement.style.display = "none";
                    // Show play button when paused
                    if (playPauseIcon) {
                        playPauseIcon.src = "/Images/playWhite.svg";
                        playPauseIcon.parentElement.style.opacity = "1";
                    }
                } else {
                    // If playing, hide serial, show equalizer
                    if (serialElement) serialElement.style.display = "none";
                    if (equalizerElement) equalizerElement.style.display = "flex";
                    // Show pause button when playing
                    if (playPauseIcon) {
                        playPauseIcon.src = "/Images/pauseWhite.svg";
                        playPauseIcon.parentElement.style.opacity = "1";
                    }
                }
            } else {
                // Remove 'active' class from the list item
                li.classList.remove("active");

                // Ensure serial is shown and equalizer is hidden for non-playing songs
                if (serialElement) serialElement.style.display = "flex";
                if (equalizerElement) equalizerElement.style.display = "none";

                // Ensure play icon is shown for non-playing songs
                if (playPauseIcon) {
                    playPauseIcon.src = "/Images/playWhite.svg";
                    playPauseIcon.parentElement.style.opacity = "1";
                }
            }
        });

        // Update playbar button
        if (playBarButton) {
            playBarButton.src = currentSong.paused ? "/Images/play.svg" : "/Images/pause.svg";
        }

        // Get current song data with context
        let currentPlaylistData = null;
        if (activePlaylistContext && activePlaylistContext.songPath && currentSong.src && currentSong.src.includes(activePlaylistContext.songPath)) {
            // Find the playlist using the active context
                for (const group of allMusicData) {
                if (group.groupLink === activePlaylistContext.groupLink) {
                    const playlist = group.playlists.find(p => p.playlistLink === activePlaylistContext.playlistLink);
                        if (playlist) {
                            currentPlaylistData = {
                                group: group,
                                playlist: playlist
                            };
                            break;
                    }
                }
            }
        }

        // Update playlist buttons
        document.querySelectorAll(".card").forEach(card => {
            const cardGroupLink = card.getAttribute("data-group-link");
            const cardPlaylistLink = card.getAttribute("data-playlist-link");
            const playlistButton = card.querySelector(".playlistButton img");
            
            if (!playlistButton) return;

            // Check if this is the active playlist where the song was originally played from
            const isActivePlaylist = activePlaylistContext && 
                activePlaylistContext.groupLink === cardGroupLink && 
                activePlaylistContext.playlistLink === cardPlaylistLink &&
                activePlaylistContext.songPath && 
                currentSong.src && 
                currentSong.src.includes(activePlaylistContext.songPath);

            // Check if this playlist contains the currently playing song
            const group = allMusicData.find(g => g.groupLink === cardGroupLink);
            const playlist = group?.playlists.find(p => p.playlistLink === cardPlaylistLink);
            const containsCurrentSong = playlist?.songs.some(song => 
                        currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
                    );

            if (isActivePlaylist) {
                // This is the active playlist - update button state
                playlistButton.src = currentSong.paused ? "/Images/play.svg" : "/Images/pause.svg";
                card.classList.add('playing');
                
                // Set background color for active playlist in mobile view
                if (window.innerWidth <= 768) {
                    card.style.setProperty('background-color', 'var(--card-hover-color)', 'important');
                }
            } else if (containsCurrentSong && !currentSong.paused) {
                // This playlist contains the current song but isn't the active playlist
                // Set the pause icon but don't add the 'playing' class
                playlistButton.src = "/Images/pause.svg";
                card.classList.remove('playing');
                card.style.removeProperty('background-color');
            } else {
                // Not the active playlist and doesn't contain the current song - reset everything
                playlistButton.src = "/Images/play.svg";
                card.classList.remove('playing');
                card.style.removeProperty('background-color');
            }
        });

        // Update sidebar playlist button
        if (sideBarPlaylistButton && sideBarPlaylistButtonContainer) {
            if (currentPlaylistData && activePlaylistContext.songPath && currentSong.src && currentSong.src.includes(activePlaylistContext.songPath)) {
                sideBarPlaylistButton.src = currentPlaylistData.playlist.playlistImage;
                sideBarPlaylistButton.alt = "Current Playlist";
                sideBarPlaylistButtonContainer.style.display = "flex";
                // Store the current playlist data for toggle functionality
                sideBarPlaylistButtonContainer.dataset.groupLink = currentPlaylistData.group.groupLink;
                sideBarPlaylistButtonContainer.dataset.playlistLink = currentPlaylistData.playlist.playlistLink;
                
                // Update center container gradient based on the playlist button image
                updateCenterContainerGradient(currentPlaylistData.playlist.playlistImage);
                // Store the current playlist gradient
                currentPlaylistGradient = currentPlaylistData.playlist.playlistImage;
            } else {
                // No active playlist - hide sidebar button
                sideBarPlaylistButtonContainer.style.display = "none";
                delete sideBarPlaylistButtonContainer.dataset.groupLink;
                delete sideBarPlaylistButtonContainer.dataset.playlistLink;
                
                // Reset gradient to default
                updateCenterContainerGradient(null);
                currentPlaylistGradient = null;
            }
        }
} catch (error) {
        console.error("Error updating play/pause icons:", error);
    }
}

// Add this new function after updatePlayPauseIcons
function updatePlaylistButtonIcons() {
    try {
        // Get all playlist buttons
        const playlistButtons = document.querySelectorAll(".playlistButton img");
        
        // Get current song data with context
        const currentContextSong = window.currentSongData ? 
            window.currentSongData.find(song => 
                currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
            ) : null;

        // Update each playlist button
        playlistButtons.forEach(button => {
            const card = button.closest(".card");
            if (!card) return;

            const groupLink = card.getAttribute("data-group-link");
            const playlistLink = card.getAttribute("data-playlist-link");
            if (!groupLink || !playlistLink) return;

            // Check if this is the active playlist where the song was originally played from
            const isActivePlaylist = activePlaylistContext && 
                activePlaylistContext.groupLink === groupLink && 
                activePlaylistContext.playlistLink === playlistLink &&
                activePlaylistContext.songPath && 
                currentSong.src && 
                currentSong.src.includes(activePlaylistContext.songPath);

            // Update button icon based on play state
            if (isActivePlaylist) {
                button.src = currentSong.paused ? "/Images/play.svg" : "/Images/pause.svg";
                if (!currentSong.paused) {
                    card.classList.add('playing');
                } else {
                    card.classList.remove('playing');
                }
            } else {
                button.src = "/Images/play.svg";
                card.classList.remove('playing');
            }
        });
    } catch (error) {
        console.error("Error updating playlist button icons:", error);
    }
}

//Automatic Next Song Play
function attachAutomaticNextSongEvents() {
    currentSong.addEventListener("ended", async () => {
        // If no song is playing, return
        if (!currentSong.src) {
            console.log("Automatic next song: currentSong.src is empty, returning.");
            return;
        }

        let nextSong = null;

        // First check if we have current song data with context
        if (window.currentSongData && window.currentSongData.length > 0) {
            console.log("Using rendered playlist for next song");
            
            // Find the current song in the context
            const currentContextSong = window.currentSongData.find(song => 
                currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
            );

            if (currentContextSong) {
                // Store current playlist data before potential reset
                currentPlaylistData = {
                    groupLink: currentContextSong.currentGroupLink,
                    groupName: currentContextSong.currentGroupName,
                    playlistLink: currentContextSong.currentPlaylistLink,
                    playlistName: currentContextSong.currentPlaylistName,
                    playlistImage: currentContextSong.currentPlaylistImage
                };

                // Find the current song's index in the rendered playlist
                const currentIndex = window.currentSongData.findIndex(song => 
                    song.songLink === currentContextSong.songLink
                );

                console.log("Current index in rendered playlist:", currentIndex);

                if (currentIndex !== -1) {
                    // If playlist has only one song, keep it active but paused
                    if (window.currentSongData.length === 1) {
                        console.log("Playlist has only one song, keeping it active but paused");
                        // Pause the current song but keep its source
                        currentSong.pause();
                        currentSong.currentTime = 0;
                        // Update all play/pause icons
                        updatePlayPauseIcons();
                        updatePlaylistButtonIcons();

                        // Keep the playlist button visible with the current playlist image
                        const sideBarPlaylistButton = document.querySelector(".sideBar .playingPlaylistButton");
                        const sideBarPlaylistButtonImg = sideBarPlaylistButton?.querySelector("img");
                        if (sideBarPlaylistButton && sideBarPlaylistButtonImg && currentPlaylistData) {
                            sideBarPlaylistButton.style.display = "flex";
                            sideBarPlaylistButtonImg.src = currentPlaylistData.playlistImage;
                            sideBarPlaylistButton.dataset.groupLink = currentPlaylistData.groupLink;
                            sideBarPlaylistButton.dataset.playlistLink = currentPlaylistData.playlistLink;
                        }

                        // Keep the song active in the playlist
                        const songList = document.querySelector(".playingPlaylistContainer .songList ul");
                        if (songList) {
                            const songLi = songList.querySelector("li");
                            if (songLi) {
                                songLi.classList.add("active");
                                const serialElement = songLi.querySelector(".serial");
                                const equalizerElement = songLi.querySelector(".equalizer");
                                if (serialElement) serialElement.style.display = "flex";
                                if (equalizerElement) equalizerElement.style.display = "none";
                            }
                        }
                        return;
                    }
                    
                    // If we're at the last song, go to first song
                    if (currentIndex === window.currentSongData.length - 1) {
                        nextSong = window.currentSongData[0];
                        console.log("Playing first song of rendered playlist");
                    } else {
                        nextSong = window.currentSongData[currentIndex + 1];
                        console.log("Playing next song in rendered playlist");
                    }
                }
            }
        } else {
            console.log("Using Hidden All Songs playlist for next song");
            // If not in a rendered playlist, check Hidden All Songs
            const allSongsGroup = allMusicData.find(group => group.groupName === "All Songs");
            if (allSongsGroup) {
                const hiddenAllSongsPlaylist = allSongsGroup.playlists.find(playlist => 
                    playlist.playlistName === "Hidden All Songs"
                );
                
                if (hiddenAllSongsPlaylist) {
                    const currentIndex = hiddenAllSongsPlaylist.songs.findIndex(song => {
                        const songFullPath = `/Songs/${song.songLink}`;
                        return songFullPath === currentSong.src;
                    });

                    console.log("Current index in Hidden All Songs:", currentIndex);

                    if (currentIndex !== -1) {
                        // If Hidden All Songs has only one song, don't repeat it
                        if (hiddenAllSongsPlaylist.songs.length === 1) {
                            console.log("Hidden All Songs has only one song, stopping playback");
                            // Reset current song
                            currentSong.src = "";
                            // Update all play/pause icons
                            updatePlayPauseIcons();
                            updatePlaylistButtonIcons();
                            // Hide the playlist button for Hidden All Songs
                            const sideBarPlaylistButton = document.querySelector(".sideBar .playingPlaylistButton");
                            if (sideBarPlaylistButton) {
                                sideBarPlaylistButton.style.display = "none";
                            }
                            return;
                        }

                        if (currentIndex === hiddenAllSongsPlaylist.songs.length - 1) {
                            nextSong = hiddenAllSongsPlaylist.songs[0];
                            console.log("Playing first song of Hidden All Songs");
                        } else {
                            nextSong = hiddenAllSongsPlaylist.songs[currentIndex + 1];
                            console.log("Playing next song in Hidden All Songs");
                        }
                    }
                }
            }
        }

        // Play the next song if found
        if (nextSong) {
            const nextSongPath = `/Songs/${nextSong.songLink}`;
            console.log("Next button: nextSongPath:", nextSongPath);
            console.log("Next button: currentSong.src before playing next:", currentSong.src);

            // If we're in fullscreen mode, update the video
            if (isFullScreen) {
                const fullScreenVideo = document.getElementById('fullScreenVideo');
                if (fullScreenVideo) {
                    try {
                        // Add fade out effect
                        fullScreenVideo.style.opacity = '0';
                        
                        // Wait for fade out
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Pause both audio and video
                        currentSong.pause();
                        fullScreenVideo.pause();

                        // Create a new video element
                        const newVideo = document.createElement('video');
                        newVideo.id = 'fullScreenVideo';
                        newVideo.className = 'fullScreenVideo';
                        newVideo.setAttribute('playsinline', '');
                        newVideo.setAttribute('webkit-playsinline', '');
                        newVideo.setAttribute('x5-playsinline', '');
                        newVideo.setAttribute('x5-video-player-type', 'h5');
                        newVideo.setAttribute('x5-video-player-fullscreen', 'true');
                        newVideo.controls = false;
                        newVideo.muted = true;
                        newVideo.style.opacity = '0';
                        
                        // Replace old video with new one
                        fullScreenVideo.parentNode.replaceChild(newVideo, fullScreenVideo);
                        
                        // Set new video source
                        newVideo.src = nextSongPath;
                        
                        // Wait for video to be ready
                        await new Promise((resolve, reject) => {
                            newVideo.addEventListener('loadedmetadata', resolve, { once: true });
                            newVideo.addEventListener('error', reject, { once: true });
                        });

                        // Reset video time
                        newVideo.currentTime = 0;
                        
                        // Fade in new video
                        newVideo.style.opacity = '1';
                        
                        // Update window.currentSongData with the next song's data
            // This is crucial for maintaining the correct context for subsequent song changes


            // Play the new song
            await playMusic(nextSongPath);
                        
                        // Play the video
                        await newVideo.play();
                    } catch (error) {
                        console.error('Error updating video:', error);
                        // If there's an error, try to recover
                        await playMusic(nextSongPath);
                }
            }
            } else {
                // Not in fullscreen, just play the new song
            await playMusic(nextSongPath);
            }
        } else {
            console.log("No next song found");
            // Reset current song
            currentSong.src = "";
            // Update all play/pause icons
            updatePlayPauseIcons();
            updatePlaylistButtonIcons();
        }
    });
}

//Format time (seconds to mm:ss)
function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

//SeekBar Funtionality
function attachSeekBarEvents() {
    const seekBar = document.querySelector(".seekBarContainer .seekBar");
    const startTime = document.querySelector(".startTime");
    const endTime = document.querySelector(".endTime");

    if (!seekBar) return;

    // Helper: update --progress CSS variable
    function setSeekBarProgress() {
        const percent = (seekBar.value / seekBar.max) * 100 || 0;
        seekBar.style.setProperty('--progress', percent + '%');
    }

    // Helper: sync video with audio time
    function syncVideoWithTime(time) {
        if (isFullScreen) {
            const fullScreenVideo = document.getElementById('fullScreenVideo');
            if (fullScreenVideo) {
                fullScreenVideo.currentTime = time;
            }
        }
    }

    // Song duration set hone par endTime update karo
    currentSong.addEventListener("loadedmetadata", () => {
        seekBar.max = currentSong.duration || 0;
        endTime.textContent = formatTime(currentSong.duration || 0);
        setSeekBarProgress();
    });

    // Song play hote waqt seekbar update karo
    currentSong.addEventListener("timeupdate", () => {
        seekBar.value = currentSong.currentTime;
        startTime.textContent = formatTime(currentSong.currentTime);
        setSeekBarProgress();
    });

    // Seekbar drag karne par song ki currentTime update karo
    seekBar.addEventListener("input", () => {
        const newTime = parseFloat(seekBar.value);
        currentSong.currentTime = newTime;
        syncVideoWithTime(newTime);
        setSeekBarProgress();
    });

    // Song end hone par seekbar reset karo
    currentSong.addEventListener("ended", () => {
        seekBar.value = 0;
        startTime.textContent = "0:00";
        setSeekBarProgress();
        syncVideoWithTime(0);
    });

    // Add mousedown event to pause video while dragging
    seekBar.addEventListener("mousedown", () => {
        if (isFullScreen) {
            const fullScreenVideo = document.getElementById('fullScreenVideo');
            if (fullScreenVideo) {
                fullScreenVideo.pause();
            }
        }
    });

    // Add mouseup event to resume video after dragging
    seekBar.addEventListener("mouseup", () => {
        if (isFullScreen) {
            const fullScreenVideo = document.getElementById('fullScreenVideo');
            if (fullScreenVideo && !currentSong.paused) {
                fullScreenVideo.play().catch(error => {
                    console.error('Error resuming video playback:', error);
                });
            }
        }
    });
        }

// Shuffle Button Functionality
function attachShuffleButtonEvents() {
    const shuffleButton = document.querySelector(".hoverScale:has(.shuffle)");
    const shuffleImg = document.querySelector(".shuffle");
    if (!shuffleButton || !shuffleImg) return;

    // Helper function to find current playlist
    function findCurrentPlaylist() {
        // First try to find from currentSongData
        if (window.currentSongData && window.currentSongData.length > 0) {
            const currentContextSong = window.currentSongData.find(song => 
                currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
            );
            if (currentContextSong) {
                const group = allMusicData.find(g => g.groupLink === currentContextSong.currentGroupLink);
                if (group) {
                    return group.playlists.find(p => p.playlistLink === currentContextSong.currentPlaylistLink);
                }
            }
        }

        // If not found in currentSongData, search all playlists
        for (const group of allMusicData) {
            for (const playlist of group.playlists) {
                const isPlayingFromPlaylist = playlist.songs.some(song =>
                    currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
                );
                if (isPlayingFromPlaylist) {
                    return playlist;
                }
            }
        }
        return null;
    }

    // Helper function to update shuffle button state
    function updateShuffleButtonState() {
        // Check if we have current song data and if the playlist has more than one song
        const hasMultipleSongs = window.currentSongData && window.currentSongData.length > 1;

        if (hasMultipleSongs) {
            shuffleButton.classList.remove('disabled');
            shuffleButton.style.opacity = '1';
            shuffleButton.style.cursor = 'pointer';
        } else {
            shuffleButton.classList.add('disabled');
            shuffleButton.style.opacity = '0.5';
            shuffleButton.style.cursor = 'not-allowed';
        }
    }

    // Click handler for shuffle button
    shuffleButton.addEventListener("click", async () => {
        // If no song is playing or playlist has only one song, don't do anything
        if (!currentSong.src || !window.currentSongData || window.currentSongData.length <= 1) {
            console.log("Shuffle disabled: No song playing or playlist has only one song");
            return;
        }

        // Find current playlist data
        const currentPlaylist = findCurrentPlaylist();
        if (!currentPlaylist) {
            console.log("No current playlist found");
            return;
        }

        // Toggle shuffle state
        const isShuffled = shuffleButton.classList.contains('active');

            if (isShuffled) {
            // Turn off shuffle
            shuffleButton.classList.remove('active');
            shuffleImg.classList.remove('active');
            shuffleImg.src = '/Images/shuffleOff.svg';

            // Restore original order
            if (window.originalSongOrder) {
            // Update the playlist in allMusicData
            const group = allMusicData.find(g => g.groupLink === currentPlaylist.groupLink);
            if (group) {
                const playlistIndex = group.playlists.findIndex(p => p.playlistLink === currentPlaylist.playlistLink);
                if (playlistIndex !== -1) {
                        group.playlists[playlistIndex].songs = [...window.originalSongOrder];
                }
            }

                // Update current song data with original order
                window.currentSongData = window.originalSongOrder.map(song => ({
                ...song,
                currentGroupLink: currentPlaylist.groupLink,
                currentGroupName: currentPlaylist.groupName,
                currentPlaylistLink: currentPlaylist.playlistLink,
                currentPlaylistName: currentPlaylist.playlistName,
                currentPlaylistImage: currentPlaylist.playlistImage
            }));

            // Update the song list UI if the playlist is currently displayed
            const playlistContainer = document.querySelector(".playingPlaylistContainer");
            if (playlistContainer && playlistContainer.style.display === "flex") {
                renderPlaylistSongs({
                    ...currentPlaylist,
                        songs: window.originalSongOrder
                }, playlistContainer);
                }
            }
            } else {
            // Turn on shuffle
            shuffleButton.classList.add('active');
            shuffleImg.classList.add('active');
            shuffleImg.src = '/Images/shuffleOn.svg';
            
            // Store original order if not already stored
            if (!window.originalSongOrder) {
                window.originalSongOrder = [...window.currentSongData];
            }

            // Shuffle the current song data
            const shuffledSongs = shuffleArray([...window.currentSongData]);
            window.currentSongData = shuffledSongs;

                // Update the playlist in allMusicData
                const group = allMusicData.find(g => g.groupLink === currentPlaylist.groupLink);
                if (group) {
                    const playlistIndex = group.playlists.findIndex(p => p.playlistLink === currentPlaylist.playlistLink);
                    if (playlistIndex !== -1) {
                    group.playlists[playlistIndex].songs = shuffledSongs;
                }
            }

                // Update the song list UI if the playlist is currently displayed
    const playlistContainer = document.querySelector(".playingPlaylistContainer");
                if (playlistContainer && playlistContainer.style.display === "flex") {
                    renderPlaylistSongs({
                        ...currentPlaylist,
                    songs: shuffledSongs
                    }, playlistContainer);
            }
        }

        // Update play/pause icons after shuffling
        updatePlayPauseIcons();
        updatePlaylistButtonIcons();
    });

    // Update shuffle button state when song changes
    currentSong.addEventListener('play', updateShuffleButtonState);
    currentSong.addEventListener('pause', updateShuffleButtonState);
    currentSong.addEventListener('ended', updateShuffleButtonState);

    // Initial state
    updateShuffleButtonState();
}

// Helper function for smooth audio transition
async function smoothAudioTransition(newSongPath) {
    if (!currentSong.src) return;

    // Fade out current audio
    const fadeOutDuration = 500; // 500ms fade out
    const startVolume = currentSong.volume;
    const fadeOutInterval = 50; // Update every 50ms
    const volumeStep = startVolume / (fadeOutDuration / fadeOutInterval);

    for (let i = 0; i < fadeOutDuration / fadeOutInterval; i++) {
        currentSong.volume = startVolume - (volumeStep * i);
        await new Promise(resolve => setTimeout(resolve, fadeOutInterval));
    }

    // Pause current audio
    currentSong.pause();

    // Update current song data
    const newSongData = allSongsMap.get(newSongPath);
    if (!newSongData) return;

    // Update window.currentSong with the new song data
    window.currentSong = newSongData;

    currentSong.src = newSongPath;
    currentSong.volume = startVolume;

    // Update UI
    updatePlayPauseIcons();
    updatePlaylistButtonIcons();
    
    // Update artwork if in artwork mode
    const artworkContainer = document.querySelector('.fullScreenArtwork');
    if (artworkContainer && artworkContainer.style.display === 'block') {
        updateArtworkImage(artworkContainer);
    }

    // Play new audio
    await currentSong.play();
}

// Add smooth audio fade transition function
async function smoothAudioFadeTransition(newSongPath) {
    console.log('Starting smooth audio fade transition to:', newSongPath);
    const fadeDuration = 500; // 500ms fade duration
    const steps = 20; // Number of steps in the fade
    const stepDuration = fadeDuration / steps;
    const volumeStep = currentSong.volume / steps;

    console.log('Fade parameters:', {
        fadeDuration,
        steps,
        stepDuration,
        volumeStep,
        currentVolume: currentSong.volume
    });

    // Fade out current song
    console.log('Starting fade out of current song');
    for (let i = 0; i < steps; i++) {
        currentSong.volume = Math.max(0, currentSong.volume - volumeStep);
        console.log(`Fade out step ${i + 1}/${steps}, volume: ${currentSong.volume.toFixed(2)}`);
        await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    // Pause current song
    console.log('Pausing current song');
    currentSong.pause();
    currentSong.currentTime = 0;

    // Play new song
    console.log('Playing new song');
    await playMusic(newSongPath);

    // Fade in new song
    console.log('Starting fade in of new song');
    currentSong.volume = 0;
    const initialVolume = 1; // Assuming initial volume is 1 before fade-in
    for (let i = 0; i < steps; i++) {
        currentSong.volume = Math.min(initialVolume, currentSong.volume + volumeStep);
        console.log(`Fade in step ${i + 1}/${steps}, volume: ${currentSong.volume.toFixed(2)}`);
        await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
    console.log('Audio fade transition completed');
}

//Previous Button Functionality
function attachPreviousButtonEvents() {
    const previousButton = document.querySelector(".previous");
    if (!previousButton) return;

    previousButton.addEventListener("click", async () => {
        // If no song is playing, return
        if (!currentSong.src) {
            console.log("Automatic next song: currentSong.src is empty, returning.");
            return;
        }

        let previousSong = null;

        // First check if we have current song data with context
        if (window.currentSongData && window.currentSongData.length > 0) {
            console.log("Using rendered playlist for previous song");
            
            // Find the current song in the context
            const currentContextSong = window.currentSongData.find(song => 
                currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
            );

            if (currentContextSong) {
                // Find the current song's index in the rendered playlist
                const currentIndex = window.currentSongData.findIndex(song => 
                    song.songLink === currentContextSong.songLink
                );

                console.log("Current index in rendered playlist:", currentIndex);

                if (currentIndex !== -1) {
                    // If we're at the first song, don't do anything
                    if (currentIndex === 0) {
                        console.log("Already at first song of playlist");
                        return;
                    } else {
                        previousSong = window.currentSongData[currentIndex - 1];
                        console.log("Playing previous song in rendered playlist");
                    }
                }
            }
        } else {
            console.log("Using Hidden All Songs playlist for previous song");
            // If not in a rendered playlist, check Hidden All Songs
            const allSongsGroup = allMusicData.find(group => group.groupName === "All Songs");
            if (allSongsGroup) {
                const hiddenAllSongsPlaylist = allSongsGroup.playlists.find(playlist => 
                    playlist.playlistName === "Hidden All Songs"
                );
                
                if (hiddenAllSongsPlaylist) {
                    const currentIndex = hiddenAllSongsPlaylist.songs.findIndex(song => {
                        const songFullPath = `/Songs/${song.songLink}`;
                        return songFullPath === currentSong.src;
                    });

                    console.log("Current index in Hidden All Songs:", currentIndex);

                    if (currentIndex !== -1) {
                        if (currentIndex === 0) {
                            console.log("Already at first song of Hidden All Songs");
                            return;
                        } else {
                            previousSong = hiddenAllSongsPlaylist.songs[currentIndex - 1];
                            console.log("Playing previous song in Hidden All Songs");
                        }
                    }
                }
            }
        }

        // Play the previous song if found
        if (previousSong) {
            const previousSongPath = `/Songs/${previousSong.songLink}`;
            console.log("Previous button: previousSongPath:", previousSongPath);
            console.log("Previous button: currentSong.src before playing previous:", currentSong.src);

            // If we're in fullscreen mode, update the video
            if (isFullScreen) {
                const fullScreenVideo = document.getElementById('fullScreenVideo');
                if (fullScreenVideo) {
                    try {
                        // Store current playback state
                        const wasPlaying = !currentSong.paused;
                        
                        // Add fade out effect
                        fullScreenVideo.style.opacity = '0';
                        
                        // Wait for fade out
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Pause both audio and video
                        currentSong.pause();
                        fullScreenVideo.pause();

                        // Create a new video element
                        const newVideo = document.createElement('video');
                        newVideo.id = 'fullScreenVideo';
                        newVideo.className = 'fullScreenVideo';
                        newVideo.setAttribute('playsinline', '');
                        newVideo.setAttribute('webkit-playsinline', '');
                        newVideo.setAttribute('x5-playsinline', '');
                        newVideo.setAttribute('x5-video-player-type', 'h5');
                        newVideo.setAttribute('x5-video-player-fullscreen', 'true');
                        newVideo.controls = false;
                        newVideo.muted = true;
                        newVideo.style.opacity = '0';
                        
                        // Replace old video with new one
                        fullScreenVideo.parentNode.replaceChild(newVideo, fullScreenVideo);
                        
                        // Set new video source
                        newVideo.src = previousSongPath;
                        
                        // Wait for video to be ready
                        await new Promise((resolve, reject) => {
                            newVideo.addEventListener('loadedmetadata', resolve, { once: true });
                            newVideo.addEventListener('error', reject, { once: true });
                        });

                        // Reset video time
                        newVideo.currentTime = 0;
                        
                        // Fade in new video
                        newVideo.style.opacity = '1';
                        
                        // Update window.currentSongData with the previous song's data
                        // This is crucial for maintaining the correct context for subsequent song changes
                        window.currentSongData = [previousSong];

                        // Play the new song with smooth fade
                        await smoothAudioFadeTransition(previousSongPath);
                        
                        // Play video if it was playing before
                        if (wasPlaying) {
                            await newVideo.play();
                        }
                    } catch (error) {
                        console.error('Error updating video:', error);
                        // If there's an error, try to recover
                        await smoothAudioFadeTransition(previousSongPath);
                    }
                }
            } else {
                // Not in fullscreen, just play the new song with smooth fade
                await smoothAudioFadeTransition(previousSongPath);
            }
        } else {
            console.log("No previous song found");
        }
    });
}

//Next Button Functionality
function attachNextButtonEvents() {
    const nextButton = document.querySelector(".next");
    if (!nextButton) return;

    nextButton.addEventListener("click", async () => {
        // If no song is playing, return
        if (!currentSong.src) {
            console.log("Automatic next song: currentSong.src is empty, returning.");
            return;
        }

        let nextSong = null;

        // First check if we have current song data with context
        if (window.currentSongData && window.currentSongData.length > 0) {
            console.log("Using rendered playlist for next song");
            
            // Find the current song in the context
            const currentContextSong = window.currentSongData.find(song => 
                currentSong.src && currentSong.src.includes(`/Songs/${song.songLink}`)
            );

            if (currentContextSong) {
                // Find the current song's index in the rendered playlist
                const currentIndex = window.currentSongData.findIndex(song => 
                    song.songLink === currentContextSong.songLink
                );

                console.log("Current index in rendered playlist:", currentIndex);

                if (currentIndex !== -1) {
                    // If we're at the last song, go to first song
                    if (currentIndex === window.currentSongData.length - 1) {
                        nextSong = window.currentSongData[0];
                        console.log("Playing first song of rendered playlist");
                    } else {
                        nextSong = window.currentSongData[currentIndex + 1];
                        console.log("Playing next song in rendered playlist");
                    }
                }
            }
        } else {
            console.log("Using Hidden All Songs playlist for next song");
            // If not in a rendered playlist, check Hidden All Songs
            const allSongsGroup = allMusicData.find(group => group.groupName === "All Songs");
            if (allSongsGroup) {
                const hiddenAllSongsPlaylist = allSongsGroup.playlists.find(playlist => 
                    playlist.playlistName === "Hidden All Songs"
                );
                
                if (hiddenAllSongsPlaylist) {
                    const currentIndex = hiddenAllSongsPlaylist.songs.findIndex(song => {
                        const songFullPath = `/Songs/${song.songLink}`;
                        return songFullPath === currentSong.src;
                    });

                    console.log("Current index in Hidden All Songs:", currentIndex);

                    if (currentIndex !== -1) {
                        if (currentIndex === hiddenAllSongsPlaylist.songs.length - 1) {
                            nextSong = hiddenAllSongsPlaylist.songs[0];
                            console.log("Playing first song of Hidden All Songs");
                        } else {
                            nextSong = hiddenAllSongsPlaylist.songs[currentIndex + 1];
                            console.log("Playing next song in Hidden All Songs");
                        }
                    }
                }
            }
        }

        // Play the next song if found
        if (nextSong) {
            const nextSongPath = `/Songs/${nextSong.songLink}`;
            console.log("Next button: nextSongPath:", nextSongPath);
            console.log("Next button: currentSong.src before playing next:", currentSong.src);

            // If we're in fullscreen mode, update the video
            if (isFullScreen) {
                const fullScreenVideo = document.getElementById('fullScreenVideo');
                if (fullScreenVideo) {
                    try {
                        // Store current playback state
                        const wasPlaying = !currentSong.paused;
                        
                        // Add fade out effect
                        fullScreenVideo.style.opacity = '0';
                        
                        // Wait for fade out
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Pause both audio and video
                        currentSong.pause();
                        fullScreenVideo.pause();

                        // Create a new video element
                        const newVideo = document.createElement('video');
                        newVideo.id = 'fullScreenVideo';
                        newVideo.className = 'fullScreenVideo';
                        newVideo.setAttribute('playsinline', '');
                        newVideo.setAttribute('webkit-playsinline', '');
                        newVideo.setAttribute('x5-playsinline', '');
                        newVideo.setAttribute('x5-video-player-type', 'h5');
                        newVideo.setAttribute('x5-video-player-fullscreen', 'true');
                        newVideo.controls = false;
                        newVideo.muted = true;
                        newVideo.style.opacity = '0';
                        
                        // Replace old video with new one
                        fullScreenVideo.parentNode.replaceChild(newVideo, fullScreenVideo);
                        
                        // Set new video source
                        newVideo.src = nextSongPath;
                        
                        // Wait for video to be ready
                        await new Promise((resolve, reject) => {
                            newVideo.addEventListener('loadedmetadata', resolve, { once: true });
                            newVideo.addEventListener('error', reject, { once: true });
                        });

                        // Reset video time
                        newVideo.currentTime = 0;
                        
                        // Fade in new video
                        newVideo.style.opacity = '1';
                        
                        // Update window.currentSongData with the next song's data
                        // This is crucial for maintaining the correct context for subsequent song changes
            

                        // Play the new song with smooth fade
                        await smoothAudioFadeTransition(nextSongPath);
                        
                        // Play video if it was playing before
                        if (wasPlaying) {
                            await newVideo.play();
                        }
                    } catch (error) {
                        console.error('Error updating video:', error);
                        // If there's an error, try to recover
                        await smoothAudioFadeTransition(nextSongPath);
                    }
                }
            } else {
                // Not in fullscreen, just play the new song with smooth fade
                await smoothAudioFadeTransition(nextSongPath);
            }
        } else {
            console.log("No next song found");
        }
    });
}

//Repeat Button Functionality
function attachRepeatButtonEvents() {
    const repeatButton = document.querySelector(".repeat");
    const repeatIcon = document.querySelector(".repeatIcon");
    if (!repeatButton || !repeatIcon) return;

    let repeatCount = 0;
    let isInfiniteRepeat = false;
    let lastClickTime = 0;
    let longPressTimer = null;
    let clickTimeout = null;
    const DOUBLE_CLICK_DURATION = 300; // 300ms for double click

    // Helper function to update repeat UI
    function updateRepeatUI() {
        const repeatCountLabel = document.querySelector(".repeatCountLabel");
        
        if (isInfiniteRepeat) {
            repeatIcon.src = "/Images/repeatOn.svg";
            if (repeatCountLabel) {
                repeatCountLabel.textContent = "∞";
                repeatCountLabel.style.display = "block";
            }
        } else if (repeatCount > 0) {
            repeatIcon.src = "/Images/repeatOn.svg";
            if (repeatCountLabel) {
                repeatCountLabel.textContent = repeatCount.toString();
                repeatCountLabel.style.display = "block";
            }
        } else {
            repeatIcon.src = "/Images/repeatOff.svg";
            if (repeatCountLabel) {
                repeatCountLabel.style.display = "none";
            }
        }
    }

    // Helper function to handle repeat logic
    function handleRepeat() {
        if (!currentSong.src) {
            console.log("Automatic next song: currentSong.src is empty, returning.");
            return;
        }

        if (isInfiniteRepeat) {
            // For infinite repeat, just restart the current song
                currentSong.currentTime = 0;
                currentSong.play();
        } else if (repeatCount > 0) {
            // For finite repeats, decrement count and restart if needed
            repeatCount--;
            if (repeatCount > 0) {
                currentSong.currentTime = 0;
                currentSong.play();
            } else {
                // Reset repeat state when count reaches 0
                repeatCount = 0;
                isInfiniteRepeat = false;
                updateRepeatUI();
            }
        }
    }

    // Add ended event listener to handle repeats
    currentSong.addEventListener("ended", handleRepeat);

    // Click handler
    repeatButton.addEventListener("mousedown", (e) => {
        e.preventDefault();
        
        // Start long press timer
        longPressTimer = setTimeout(() => {
            // Long press detected - turn off repeat
            repeatCount = 0;
            isInfiniteRepeat = false;
            updateRepeatUI();
        }, 500); // 500ms for long press
    });

    repeatButton.addEventListener("mouseup", (e) => {
        e.preventDefault();
        
        // Clear long press timer
        clearTimeout(longPressTimer);

        // Handle click
        if (clickTimeout === null) {
            // First click
            clickTimeout = setTimeout(() => {
                // Single click - increment repeat count
                if (!isInfiniteRepeat) {
                    repeatCount++;
                    updateRepeatUI();
                }
                clickTimeout = null;
            }, DOUBLE_CLICK_DURATION);
        } else {
            // Double click detected
            clearTimeout(clickTimeout);
            clickTimeout = null;
            
            // Toggle infinite repeat
            isInfiniteRepeat = !isInfiniteRepeat;
            if (!isInfiniteRepeat) {
                repeatCount = 0;
            }
            updateRepeatUI();
        }
    });

    // Cancel long press if mouse leaves button
    repeatButton.addEventListener("mouseleave", () => {
        clearTimeout(longPressTimer);
    });

    // Initial UI state
    updateRepeatUI();
}

//Volume Functionality
function attachVolumeBarEvents() {
    const volumeBar = document.querySelector(".volumeBar .seekBarContainer .seekBar");
    const volumeIcon = document.querySelector(".volumeBar .volumeIcon");

    if (!volumeBar || !volumeIcon) {
        console.error('Volume elements not found');
        return;
    }

    // Helper: update --progress CSS variable
    function setVolumeBarProgress() {
        const percent = (volumeBar.value / volumeBar.max) * 100 || 0;
        volumeBar.style.setProperty('--progress', percent + '%');
    }

    // Default volume set karo
    currentSong.volume = 0.75;
    volumeBar.value = 0.75;
    setVolumeBarProgress();

    // Volume change hone par audio ki volume set karo
    volumeBar.addEventListener("input", function () {
        const vol = parseFloat(this.value);
        currentSong.volume = vol;
        setVolumeBarProgress();

        // Volume icon change karo (4 cases)
            if (vol === 0) {
                volumeIcon.src = "/Images/mute.svg";
            } else if (vol > 0 && vol <= 0.25) {
                volumeIcon.src = "/Images/lowUnmute.svg";
            } else if (vol > 0.25 && vol <= 0.75) {
                volumeIcon.src = "/Images/medUnmute.svg";
            } else if (vol > 0.75) {
                volumeIcon.src = "/Images/unmute.svg";
            }
    });

    // Volume icon click karne par mute/unmute toggle karo
    volumeIcon.addEventListener("click", () => {
        if (currentSong.volume > 0) {
            // Store current volume before muting
            volumeBar.dataset.lastVolume = currentSong.volume;
            currentSong.volume = 0;
    const initialVolume = 1; // Assuming initial volume is 1 before fade-in
            volumeBar.value = 0;
            volumeIcon.src = "/Images/mute.svg";
        } else {
            // Restore last volume or default to 0.75
            const lastVolume = parseFloat(volumeBar.dataset.lastVolume) || 0.75;
            currentSong.volume = lastVolume;
            volumeBar.value = lastVolume;
            // Update icon based on restored volume
            if (lastVolume <= 0.25) {
                volumeIcon.src = "/Images/lowUnmute.svg";
            } else if (lastVolume <= 0.75) {
                volumeIcon.src = "/Images/medUnmute.svg";
            } else {
                volumeIcon.src = "/Images/unmute.svg";
            }
        }
        setVolumeBarProgress();
    });

    // Initial icon state set karo
    if (currentSong.volume === 0) {
        volumeIcon.src = "/Images/mute.svg";
    } else if (currentSong.volume <= 0.25) {
        volumeIcon.src = "/Images/lowUnmute.svg";
    } else if (currentSong.volume <= 0.75) {
        volumeIcon.src = "/Images/medUnmute.svg";
    } else {
        volumeIcon.src = "/Images/unmute.svg";
    }
}


//Search input Functionality
function attachSearchEvents() {
    const searchInput = document.querySelector(".searchInput input");
    const clearButton = document.querySelector(".clearSearch");
    if (!searchInput || !clearButton) return;

    // Function to handle search
    function handleSearch(searchTerm) {
        // If search is empty, show all groups
        if (!searchTerm) {
            renderGroups(allMusicData);
            clearButton.style.display = "none";
            return;
        }

        // Show clear button when there's text
        clearButton.style.display = "block";

        // Split search term into words for combined search
        const searchWords = searchTerm.split(/\s+/);

        // Filter groups and playlists based on search term
        const filteredGroups = allMusicData.map(group => {
            // Check if group name matches
            const groupNameMatch = group.groupName.toLowerCase().includes(searchTerm);

            // Filter playlists within each group
            const filteredPlaylists = group.playlists.filter(playlist => {
                // Search in playlist name
                const playlistNameMatch = playlist.playlistName.toLowerCase().includes(searchTerm);
                
                // Combined search: Check if group name and playlist name match different search words
                const combinedMatch = searchWords.every(word => {
                    const groupWordMatch = group.groupName.toLowerCase().includes(word);
                    const playlistWordMatch = playlist.playlistName.toLowerCase().includes(word);
                    return groupWordMatch || playlistWordMatch;
                });
                
                // Search in song names and singers
                const songMatch = playlist.songs.some(song => {
                    const songNameMatch = song.songName.toLowerCase().includes(searchTerm);
                    const singerMatch = song.singerNames.toLowerCase().includes(searchTerm);
                    return songNameMatch || singerMatch;
                });

                return playlistNameMatch || songMatch || combinedMatch;
            });

            // Include group if either group name matches or it has matching playlists
            if (groupNameMatch || filteredPlaylists.length > 0) {
                return {
                    ...group,
                    playlists: groupNameMatch ? group.playlists : filteredPlaylists
                };
            }
            return null;
        }).filter(Boolean); // Remove null groups

        // Render filtered results
        renderGroups(filteredGroups);
    }

    // Input event handler
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        handleSearch(searchTerm);
    });

    // Clear button click handler
    clearButton.addEventListener("click", () => {
        searchInput.value = "";
        handleSearch("");
        searchInput.focus();
    });

    // Handle escape key
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            searchInput.value = "";
            handleSearch("");
        }
    });
}

// Function to handle sidebar navigation
function attachSidebarEvents() {
    const libraryButton = document.querySelector('.libraryButton');
    const playlistButton = document.querySelector('.playingPlaylistButton');
    const libraryContainer = document.querySelector('.libraryContainer');
    const playlistContainer = document.querySelector('.playingPlaylistContainer');
    const sideBar = document.querySelector('.sideBar');
    const centerContainer = document.querySelector('.centerContainer');

    // Remove existing event listeners by cloning and replacing elements
    if (libraryButton) {
        const newLibraryButton = libraryButton.cloneNode(true);
        libraryButton.parentNode.replaceChild(newLibraryButton, libraryButton);
    }
    if (playlistButton) {
        const newPlaylistButton = playlistButton.cloneNode(true);
        playlistButton.parentNode.replaceChild(newPlaylistButton, playlistButton);
    }

    // Get the new elements after replacement
    const newLibraryButton = document.querySelector('.libraryButton');
    const newPlaylistButton = document.querySelector('.playingPlaylistButton');

    // Library button click handler
    if (newLibraryButton) {
        newLibraryButton.addEventListener('click', () => {
        // Toggle library container
        if (libraryContainer.style.display === 'none' || !libraryContainer.style.display) {
            libraryContainer.style.display = 'flex';
            playlistContainer.style.display = 'none';
            sideBar.style.display = 'none';
            // Adjust center container width
            if (centerContainer) {
                centerContainer.style.width = 'calc(100vw - 16px)';
            }
        } else {
            libraryContainer.style.display = 'none';
            sideBar.style.display = 'flex';
            // Adjust center container width
            if (centerContainer) {
                centerContainer.style.width = 'calc(100vw - 16px - 5vw)';
            }
        }
    });
    }

    // Playlist button click handler
    if (newPlaylistButton) {
        newPlaylistButton.addEventListener('click', () => {
        // Get the current playlist data from the button's dataset
            const groupLink = newPlaylistButton.dataset.groupLink;
            const playlistLink = newPlaylistButton.dataset.playlistLink;

        if (!groupLink || !playlistLink) {
            console.log("No playlist data found in button dataset");
            return;
        }

            // Find the playlist data from allMusicData
            const group = allMusicData.find(g => g.groupLink === groupLink);
            if (!group) {
                console.log("Group not found:", groupLink);
                return;
            }

            const playlist = group.playlists.find(p => p.playlistLink === playlistLink);
            if (!playlist) {
                console.log("Playlist not found:", playlistLink);
                return;
            }
            
            // Check if the playlist container is currently visible
            const isPlaylistVisible = playlistContainer.style.display === 'flex';

            if (isPlaylistVisible) {
                // If playlist is visible, hide it and show sidebar
                playlistContainer.style.display = 'none';
                sideBar.style.display = 'flex';
                // Adjust center container width
                if (centerContainer) {
                    centerContainer.style.width = 'calc(100vw - 16px - 5vw)';
                }
            } else {
                // If playlist is hidden, show it and hide sidebar
                playlistContainer.style.display = 'flex';
                sideBar.style.display = 'none';
                // Adjust center container width
                if (centerContainer) {
                    centerContainer.style.width = 'calc(100vw - 16px)';
                }

                // Render the playlist with its current context
                let playlistTitle = playlist.playlistName;
                let playlistDescription = `${playlist.songs.length} songs`;

                // Check if it's an artist playlist
                if (group.groupName === "Popular artist") {
                    playlistDescription = "Artist";
                }
                // Check if it's a single song playlist
                else if (playlist.songs.length === 1) {
                    playlistDescription = "Single";
                }
                // Check if it's an album
                else if (group.groupName.toLowerCase().includes("album")) {
                    playlistDescription = "Album";
                }

                // Inject playlist context into each song
                const resolvedSongs = playlist.songs.map(song => {
                    // Get the original song from allSongsMap using songId
                    const originalSong = allSongsMap.get(song.songId);
                    if (!originalSong) return null;

                    // Create a new song object with injected playlist context
                    return {
                        ...originalSong,
                        currentGroupLink: playlist.groupLink,
                        currentGroupName: playlist.groupName,
                        currentPlaylistLink: playlist.playlistLink,
                        currentPlaylistName: playlist.playlistName,
                        currentPlaylistImage: playlist.playlistImage
                    };
                }).filter(Boolean);

                // Store the resolved songs with context
                window.currentSongData = resolvedSongs;

                // Render the playlist
                renderPlaylistSongs(playlist, playlistContainer, playlistTitle, playlistDescription);
            }
        });
    }
}

// Function to handle collapse button click
function attachCollapseButtonEvents() {
    // Library container collapse
    const libraryCollapse = document.querySelector('.libraryContainer .collapse');
    if (libraryCollapse) {
        libraryCollapse.addEventListener('click', () => {
            const libraryContainer = document.querySelector('.libraryContainer');
            const sideBar = document.querySelector('.sideBar');
            const centerContainer = document.querySelector('.centerContainer');

            if (libraryContainer && sideBar && centerContainer) {
                // Hide library container
                libraryContainer.style.display = 'none';
                // Show sidebar
                sideBar.style.display = 'flex';
                // Adjust center container width
                centerContainer.style.width = 'calc(100vw - 16px - 5vw)';
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.playingPlaylistContainer .collapse')) {
            const playlistContainer = document.querySelector('.playingPlaylistContainer');
            const overlay = document.querySelector('.playlist-overlay');
            const sideBar = document.querySelector('.sideBar');
            const centerContainer = document.querySelector('.centerContainer');
            
            
            if (playlistContainer) {
                if (window.innerWidth <= 768) {
                    // Mobile view
                    playlistContainer.classList.remove('active');
                    playlistContainer.style.transform = 'translateY(-100%)';
                    playlistContainer.style.display = 'none';
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                } else {
                    // Desktop view
                    playlistContainer.style.display = 'none';
                    if (sideBar) sideBar.style.display = 'flex';
                    if (centerContainer) centerContainer.style.width = 'calc(100vw - 16px - 5vw)';
                }
            }
        }
    });
}

// Add this function after the existing gradient-related functions
function updateCenterContainerGradient(playlistImageUrl) {
    const centerContainer = document.querySelector('.centerContainer');
    if (!centerContainer) return;

    // Create a new image element
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        try {
            // Get the dominant color using ColorThief
            const colorThief = new ColorThief();
            const [r, g, b] = colorThief.getColor(img);
            
            // Calculate color brightness (0-255)
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            
            // Normalize the color to a medium brightness
            let normalizedR = r, normalizedG = g, normalizedB = b;
            
            if (brightness < 100) {
                // If too dark, lighten it
                normalizedR = Math.min(r + 50, 255);
                normalizedG = Math.min(g + 50, 255);
                normalizedB = Math.min(b + 50, 255);
            } else if (brightness > 200) {
                // If too light, darken it
                normalizedR = Math.max(r - 50, 0);
                normalizedG = Math.max(g - 50, 0);
                normalizedB = Math.max(b - 50, 0);
            }
            
            // Create gradient that transitions to the tertiary color within the top 25%
            const gradient = `linear-gradient(to bottom, 
                rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) -40%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 60%, var(--tertiary-color) 40%) -25%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 50%, var(--tertiary-color) 50%) -15%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 40%, var(--tertiary-color) 60%) -5%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 30%, var(--tertiary-color) 70%) 5%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 25%, var(--tertiary-color) 75%) 15%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 20%, var(--tertiary-color) 80%) 25%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 15%, var(--tertiary-color) 85%) 35%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 10%, var(--tertiary-color) 90%) 40%,
                color-mix(in srgb, rgb(${normalizedR}, ${normalizedG}, ${normalizedB}) 5%, var(--tertiary-color) 95%) 45%,
                var(--tertiary-color) 50%,
                var(--tertiary-color) 100%
            )`;
            
            // Apply the gradient to the center container
            centerContainer.style.background = gradient;

            // Set the CSS variable for the active filter button color
            document.documentElement.style.setProperty('--active-filter-color', `rgb(${normalizedR}, ${normalizedG}, ${normalizedB})`);

            // Calculate hover color based on brightness
            let hoverR, hoverG, hoverB;
            if (brightness < 125) {
                // For dark colors, make hover lighter
                hoverR = Math.min(r + 40, 255);
                hoverG = Math.min(g + 40, 255);
                hoverB = Math.min(b + 40, 255);
            } else {
                // For light colors, make hover darker
                hoverR = Math.max(r - 40, 0);
                hoverG = Math.max(g - 40, 0);
                hoverB = Math.max(b - 40, 0);
            }
            
            // Add CSS variable for card hover color
            document.documentElement.style.setProperty('--card-hover-color', `rgba(${hoverR}, ${hoverG}, ${hoverB}, 0.3)`);
        } catch (error) {
            console.error('Error applying gradient:', error);
        }
    };

    img.onerror = () => {
        // Fallback to default gradient if image fails to load
        centerContainer.style.background = 'linear-gradient(to bottom, rgba(18, 18, 18, 0.9) 0%, color-mix(in srgb, rgba(18, 18, 18, 0.9) 30%, var(--tertiary-color) 70%) 15%, var(--tertiary-color) 25%, var(--tertiary-color) 100%)';
        // Reset card hover color to default
        document.documentElement.style.setProperty('--card-hover-color', 'rgba(35, 35, 35, 0.3)');
        // Reset active filter color to default
        document.documentElement.style.setProperty('--active-filter-color', 'white');
    };

    img.src = playlistImageUrl;
}

// Add function to add song to allSongsMap
function addSongToAllSongsMap(songName, singerNames, songLink) {
    const songId = generateSongId(songName, singerNames);
    const songData = {
        songId,
        songLink,
        songName,
        singerNames,
        songImage: `/Images/Songs/${songName.trim()}.jpg`,
        groupLink: "All Songs",
        playlistLink: "Hidden All Songs"
    };
    allSongsMap.set(songId, songData);
    console.log(`Added song "${songName}" to allSongsMap`);
    return songData;
}

// Full Screen Video Functionality
function attachFullScreenButtonEvents() {
    const fullScreenButton = document.querySelector('.songFullScreenButton');
    const fullScreenIcon = fullScreenButton?.querySelector('img:first-child');
    const exitFullScreenIcon = fullScreenButton?.querySelector('img:last-child');
    const videoContainer = document.querySelector('.videoContainer');
    let fullScreenVideo = null;
    let lastSyncTime = 0;
    const SYNC_THRESHOLD = 0.1; // Threshold for time sync in seconds

    // Helper function to create video element
    function createVideoElement() {
        // First, remove any existing video elements
        const existingVideo = document.getElementById('fullScreenVideo');
        if (existingVideo) {
            existingVideo.remove();
        }

        // Create new video element
        const video = document.createElement('video');
        video.id = 'fullScreenVideo';
        video.className = 'fullScreenVideo';
        video.playsInline = true;
        video.muted = true; // Mute video to prevent double audio
        video.disablePictureInPicture = true;
        video.disableRemotePlayback = true;
        video.style.display = 'block'; // Show video by default

        // Add to container
        videoContainer.appendChild(video);
        return video;
    }

    // Helper function to update fullscreen button state
    function updateFullScreenButtonState() {
        const fullScreenButton = document.querySelector('.songFullScreenButton');
        if (!fullScreenButton) return;
        
        if (isFullScreen) {
            fullScreenButton.classList.add('active');
            fullScreenButton.querySelector('img').src = '/Images/exitFullScreen.svg';
        } else {
            fullScreenButton.classList.remove('active');
            fullScreenButton.querySelector('img').src = '/Images/fullScreen.svg';
        }
    }

    // Helper function to sync video with audio
    function syncVideoWithAudio() {
        if (!isFullScreen || !fullScreenVideo || !currentSong) return;
        
        // Only sync if the difference is significant
        if (Math.abs(fullScreenVideo.currentTime - currentSong.currentTime) > SYNC_THRESHOLD) {
                fullScreenVideo.currentTime = currentSong.currentTime;
        }
    }

    // Helper function to handle artwork button click
    function handleArtworkButtonClick() {
        const artworkButton = document.querySelector(".artworkButton img");
        const videoButton = document.querySelector(".videoButton img");
        const fullScreenVideo = document.getElementById('fullScreenVideo');
        
        if (!artworkButton || !videoButton || !fullScreenVideo) return;

        // Update button states
        artworkButton.src = '/Images/artworkOn.svg';
        videoButton.src = '/Images/videoOff.svg';

        // Keep video playing but hide its controls
        fullScreenVideo.style.opacity = '0.3';
        fullScreenVideo.style.pointerEvents = 'none';
        
        // Create and show artwork if it doesn't exist
        let artworkContainer = document.querySelector('.fullScreenArtwork');
        if (!artworkContainer) {
            artworkContainer = document.createElement('div');
            artworkContainer.className = 'fullScreenArtwork';
            const artworkImg = document.createElement('img');
            // Set initial image source from current song data
            if (window.currentSong && window.currentSong.songImage) {
                artworkImg.src = window.currentSong.songImage;
                console.log("Initial artwork from window.currentSong:", window.currentSong.songImage);
            } else if (window.currentSongData && window.currentSongData[0] && window.currentSongData[0].songImage) {
                artworkImg.src = window.currentSongData[0].songImage;
                console.log("Initial artwork from window.currentSongData[0]:", window.currentSongData[0].songImage);
            } else {
                artworkImg.src = '/Images/Songs/default.jpg';
                console.log("Initial artwork: default image");
            }
            artworkContainer.appendChild(artworkImg);
            fullScreenVideo.parentElement.appendChild(artworkContainer);
        }
        
        // Update artwork image and color
        updateArtworkImage(artworkContainer);
        artworkContainer.style.display = 'block';
    }



    // Helper function to handle video button click
    function handleVideoButtonClick() {
        const artworkButton = document.querySelector(".artworkButton img");
        const videoButton = document.querySelector(".videoButton img");
        const fullScreenVideo = document.getElementById('fullScreenVideo');
        
        if (!artworkButton || !videoButton || !fullScreenVideo) return;

        // Update button states
        artworkButton.src = '/Images/artworkOff.svg';
        videoButton.src = '/Images/videoOn.svg';

        // Show video with full opacity and controls
        fullScreenVideo.style.opacity = '1';
        fullScreenVideo.style.pointerEvents = 'auto';
        
        // Hide artwork
        const artworkElement = document.querySelector('.fullScreenArtwork');
        if (artworkElement) {
            artworkElement.style.display = 'none';
        }
    }

    // Attach click events to artwork and video buttons
    function attachFullScreenControlButtonsEvents() {
        const artworkButton = document.querySelector(".artworkButton");
        const videoButton = document.querySelector(".videoButton");

        if (artworkButton) {
            artworkButton.addEventListener("click", handleArtworkButtonClick);
        }

        if (videoButton) {
            videoButton.addEventListener("click", handleVideoButtonClick);
        }
    }

    async function enterFullScreen() {
        if (!currentSong.src) {
            const videoContainer = document.querySelector('.videoContainer');
            if (!videoContainer) return;
            console.log("Automatic next song: currentSong.src is empty, returning.");
            return;
        }

        try {
            // Show loading state
            videoContainer.classList.add('loading');

            // Create new video element
            fullScreenVideo = createVideoElement();
            
            // Set video source to current song
            fullScreenVideo.src = currentSong.src;
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                fullScreenVideo.addEventListener('loadedmetadata', resolve, { once: true });
                fullScreenVideo.addEventListener('error', reject, { once: true });
            });

            // Remove loading state
            videoContainer.classList.remove('loading');
            
            // Show video container
            videoContainer.classList.remove('hidden');

            // Update playlist name in fullscreen header
            // Update playlist name in fullscreen header
            const playlistNameElement = document.querySelector('.fullScreenHeader .playlistName');
            if (playlistNameElement) {
                // Get the current playlist name from the active playlist container
                const activePlaylistContainer = document.querySelector('.playingPlaylistContainer');
                const currentPlaylistName = activePlaylistContainer ? 
                    activePlaylistContainer.querySelector('.playlistTitle')?.textContent : 
                    'Unknown Playlist';
                
                playlistNameElement.textContent = currentPlaylistName;
            }
            
            // Sync video with current audio state
            fullScreenVideo.currentTime = currentSong.currentTime;

            // Move playBar into videoContainer
            const playBar = document.querySelector('.playBar');
            if (playBar) {
                videoContainer.appendChild(playBar);
                playBar.style.position = 'fixed';
                playBar.style.bottom = '0';
                playBar.style.left = '0';
                playBar.style.width = '100%';
                playBar.style.zIndex = '1001';
            }

            // Hide other UI elements
            document.querySelector('.container').style.opacity = '0.3';

            // Start sync interval
            startSyncInterval();

            // Start auto-hide timer
            startAutoHideTimer();

            // Attach control button events
            attachFullScreenControlButtonsEvents();

            // Set initial button states
            const videoButton = document.querySelector(".videoButton img");
            const artworkButton = document.querySelector(".artworkButton img");
            if (videoButton) videoButton.src = '/Images/videoOn.svg';
            if (artworkButton) artworkButton.src = '/Images/artworkOff.svg';


            // Hide elements in mobile view
            if (window.innerWidth <= 768) {
                const elementsToHide = [
                    '.songInfo',
                    '.shuffle',
                    '.repeat',
                    '.Playing',
                    '.Lyrics',
                    '.Queue',
                    '.Connectdevice',
                    '.Miniplayer',
                    '.volumeBar'
                ];

                elementsToHide.forEach(selector => {
                    const element = document.querySelector(selector);
                    if (element) {
                        element.style.display = 'none';
                    } else {
                        console.warn(`Element not found: ${selector}`);
                    }
                });


                const mainPlay = document.querySelector('.mainPlay');
                const playBarButton = document.querySelector('.playBarButton');
                const playPause = document.querySelector('.playPause');
                const timeBar = document.querySelector('.timeBar');
                const startTime = timeBar.querySelector('.startTime');
                const endTime = timeBar.querySelector('.endTime');
                const seekBar = timeBar.querySelector('.seekBar');q
                const playOptions = document.querySelector('.playOptions');


                // Center the playPause button
                if (playPause) {
                    playPause.style.position = 'fixed';
                    playPause.style.top = '50%';
                    playPause.style.left = '50%';
                    playPause.style.transform = 'translate(-50%, -50%)';
                    playPause.style.zIndex = '1002';
                }

                // Position the timeBar at the bottom
                if (timeBar) {
                    timeBar.style.backgroundColor = 'var(--active-filter-color)';
                    timeBar.style.padding = '10px 100px';
                    timeBar.style.position = 'fixed';
                    timeBar.style.bottom = '0';
                    timeBar.style.left = '50%';
                    timeBar.style.transform = 'translateX(-50%)';
                    timeBar.style.width = "100%"
                    timeBar.style.height = "5%"
                    timeBar.style.zIndex = '1001';
                }

                if (startTime) {
                    startTime.style.padding = '0 10px';
                }
                if (endTime) {
                    endTime.style.padding = '0 10px';
                }
                if (seekBar) {
                    seekBar.style.width = "100%";
                }



                if (playBarButton) {
                    playBarButton.style.backgroundColor = 'transparent';
                    const playBarButtonImg = playBarButton.querySelector('img');
                    if (playBarButtonImg) {
                        playBarButtonImg.style.width = '50px';
                        playBarButtonImg.style.height = '50px';
                        playBarButtonImg.style.filter = 'invert(1)';
                    }
                }

                
                if (playOptions) {
                    playOptions.style.position = 'fixed';
                    playOptions.style.bottom = '0';
                    playOptions.style.right = '0';
                    playOptions.style.zIndex = '1002';
                }
                


                // Style the playBar
                playBar.style.backgroundColor = 'transparent';
                playBar.style.height = '100%';
                playBar.style.width = '100%';




            }


            //hide .mainNav in mobile view
            const mainNav = document.querySelector('.mainNav');
            if(mainNav && window.innerWidth <= 768){
                mainNav.style.transform = 'translateY(100%)';
                mainNav.style.transition = 'transform 0.3s ease-in-out';
            }





            // Request fullscreen
            if (videoContainer.requestFullscreen) {
                await videoContainer.requestFullscreen();
            } else if (videoContainer.webkitRequestFullscreen) {
                await videoContainer.webkitRequestFullscreen();
            } else if (videoContainer.mozRequestFullScreen) {
                await videoContainer.mozRequestFullScreen();
            } else if (videoContainer.msRequestFullscreen) {
                await videoContainer.msRequestFullscreen();
            }

            if (window.innerWidth <= 768 && screen.orientation?.lock){
                try {
                    await screen.orientation.lock('landscape');
                } catch (error) {
                    console.error('Error locking screen orientation:', error);
                }
            }

            // Update state
            isFullScreen = true;
            showControls();
            startAutoHideTimer();
            updateFullScreenButtonState();
        

            // Play video if audio is playing
            if (!currentSong.paused) {
                await fullScreenVideo.play();
            }
        } catch (error) {
            console.error('Error entering fullscreen:', error);
            videoContainer.classList.remove('loading');
            exitFullScreen();
        }
    }


    async function exitFullScreen() {
        try {
            // Stop sync interval first to prevent any interference
            stopSyncInterval();
            
            // Clear auto-hide timer
            if (autoHideTimer) {
                clearTimeout(autoHideTimer);
                autoHideTimer = null;
            }
            
            // Store current playback state
            const wasPlaying = !currentSong.paused;
            const currentTime = currentSong.currentTime;
            
            // Pause video first
            if (fullScreenVideo) {
                fullScreenVideo.pause();
                fullScreenVideo.remove();
                fullScreenVideo = null;
            }
    
            // Remove artwork if it exists
            const artworkElement = document.querySelector('.fullScreenArtwork');
            if (artworkElement) {
                artworkElement.remove();
            }
    
            // Exit fullscreen
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            } else {
                console.error('Fullscreen exit API not supported');
            }
    
            // Unlock orientation when exiting fullscreen
            if (window.innerWidth <= 768 && screen.orientation?.unlock) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                    await screen.orientation.unlock();
                } catch (error) {
                    console.error('Error unlocking screen orientation:', error);
                }
            }
    
            // Show .playBar when exiting fullscreen
            const playBar = document.querySelector('.playBar');
            if (playBar && window.innerWidth <= 768) {
                playBar.style.display = 'flex';
            }
    
            // Show .mainNav when exiting fullscreen
            const mainNav = document.querySelector('.mainNav');
            if (mainNav && window.innerWidth <= 768) {
                mainNav.style.transform = 'translateY(0)';
                mainNav.style.transition = 'transform 0.3s ease-in-out';
            }
    
            // Reset state
            isFullScreen = false;
            hideControls();
            videoContainer.classList.add('hidden');
            updateFullScreenButtonState();
    
            // Move playBar back to its original position
            if (playBar) {
                document.body.appendChild(playBar);
                playBar.style.position = '';
                playBar.style.bottom = '';
                playBar.style.left = '';
                playBar.style.width = '';
                playBar.style.zIndex = '';
                playBar.style.opacity = '1';
            }
    
            // Show other UI elements
            document.querySelector('.container').style.opacity = '1';
    
            // Restore audio playback state
            if (wasPlaying) {
                requestAnimationFrame(() => {
                    currentSong.play().catch(error => {
                        console.error('Error resuming playback:', error);
                    });
                });
            }
        } catch (error) {
            console.error('Error exiting fullscreen:', error);
            // Force cleanup
            videoContainer.classList.add('hidden');
            isFullScreen = false;
            updateFullScreenButtonState();
            
            // Move playBar back
            const playBar = document.querySelector('.playBar');
            if (playBar) {
                document.body.appendChild(playBar);
                playBar.style.position = '';
                playBar.style.bottom = '';
                playBar.style.left = '';
                playBar.style.width = '';
                playBar.style.zIndex = '';
                playBar.style.opacity = '1';
            }
            
            document.querySelector('.container').style.opacity = '1';
            
            // Clean up video element
            if (fullScreenVideo) {
                fullScreenVideo.remove();
                fullScreenVideo = null;
            }
        }
    }

    // Function to start sync interval
    function startSyncInterval() {
        stopSyncInterval(); // Clear any existing interval
        function syncLoop() {
            syncVideoWithAudio();
            window.videoSyncInterval = requestAnimationFrame(syncLoop);
        }
        window.videoSyncInterval = requestAnimationFrame(syncLoop);
    }

    // Function to stop sync interval
    function stopSyncInterval() {
        if (window.videoSyncInterval) {
            cancelAnimationFrame(window.videoSyncInterval);
            window.videoSyncInterval = null;
        }
    }

    // Handle fullscreen change events
    function handleFullscreenChange() {
        const isInFullscreen = document.fullscreenElement || 
                             document.webkitFullscreenElement || 
                             document.mozFullScreenElement || 
                             document.msFullscreenElement;

        if (!isInFullscreen && isFullScreen) {
            setTimeout(() => {
                exitFullScreen();
            }, 100);
        }
    }

    // Add fullscreen change event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Sync video with audio playback
    currentSong.addEventListener('play', () => {
        if (isFullScreen && fullScreenVideo) {
            fullScreenVideo.play().catch(error => {
                console.error('Error playing video:', error);
            });
        }
    });

    currentSong.addEventListener('pause', () => {
        if (isFullScreen && fullScreenVideo) {
            fullScreenVideo.pause();
        }
    });

    currentSong.addEventListener('timeupdate', () => {
        if (isFullScreen) {
            const currentTime = Date.now();
            if (currentTime - lastSyncTime > 100) { // Limit sync frequency
                syncVideoWithAudio();
                lastSyncTime = currentTime;
            }
        }
    });

    // Handle video errors
    videoContainer.addEventListener('error', (e) => {
        console.error('Video error:', e);
        exitFullScreen();
    });

    // Click handler for full screen button
    fullScreenButton.addEventListener('click', () => {
        if (isFullScreen) {
            exitFullScreen();
        } else {
            enterFullScreen();
        }
    });

    // Handle escape key to exit full screen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFullScreen) {
            exitFullScreen();
        }
    });

    // Update button state when song changes
    currentSong.addEventListener('play', updateFullScreenButtonState);
    currentSong.addEventListener('pause', updateFullScreenButtonState);
    currentSong.addEventListener('ended', updateFullScreenButtonState);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        stopSyncInterval();
        if (fullScreenVideo) {
            fullScreenVideo.remove();
        }
    });

    // Initial state
    updateFullScreenButtonState();
}

function startAutoHideTimer() {
    // Clear any existing timer
    if (autoHideTimer) {
        clearTimeout(autoHideTimer);
    }

    // Show controls
    showControls();

    // Set new timer
    autoHideTimer = setTimeout(() => {
        hideControls();
    }, 3000); // Hide after 3 seconds
}

function showControls() {
    const header = document.querySelector('.fullScreenHeader');
    const playBar = document.querySelector('.videoContainer .playBar');
    
    if (header) header.classList.remove('hide');
    if (playBar) playBar.classList.remove('hide');
    isControlsVisible = true;
}

function hideControls() {
    const header = document.querySelector('.fullScreenHeader');
    const playBar = document.querySelector('.videoContainer .playBar');
    
    if (header) header.classList.add('hide');
    if (playBar) playBar.classList.add('hide');
    isControlsVisible = false;
}

// Add event listeners for mouse movement
function attachFullScreenControlsEvents() {
    const videoContainer = document.querySelector('.videoContainer');
    
    if (!videoContainer) return;

    videoContainer.addEventListener('mousemove', () => {
        if (isFullScreen) {
            showControls();
            startAutoHideTimer();
        }
    });

    videoContainer.addEventListener('mouseleave', () => {
        if (isFullScreen) {
            hideControls();
            if (autoHideTimer) {
                clearTimeout(autoHideTimer);
            }
        }
    });
}


// Add separate event listener for playBar interactions
const playBar = document.querySelector('.playBar');
if (playBar) {
    // Track if we're currently interacting with playBar
    let isInteracting = false;

    playBar.addEventListener('mouseenter', () => {
        isInteracting = true;
    });

    playBar.addEventListener('mouseleave', () => {
        isInteracting = false;
        // Start timer when leaving playBar
        if (navTimer) clearTimeout(navTimer);
        navTimer = setTimeout(() => {
            const mainNav = document.querySelector('.mainNav');
            if (mainNav && !isInteracting) {
                mainNav.classList.add('hidden');
            }
        }, NAV_TIMEOUT);
    });
}


// Update event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initial show of nav
    handleMainNavVisibility();
    
    // Show nav on scroll
    document.addEventListener('scroll', handleMainNavVisibility);
    
    // Show nav on touch
    document.addEventListener('touchstart', handleMainNavVisibility);
    
    // Show nav on mouse move
    document.addEventListener('mousemove', handleMainNavVisibility);
    
    // Show nav when clicking mainNav buttons
    const mainNavButtons = document.querySelectorAll('.mainNav button');
    mainNavButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMainNavVisibility(e);
        });
    });

});

// Mobile search events
function MobileSearchEvents() {
    const header = document.querySelector('.headerContainer1');
    const mainNav = document.querySelector('.mainNav');
    const searchButton = document.querySelector('.mainNav button:nth-child(2)'); // Search button
    const searchIcon = searchButton.querySelector('img');
    const searchContainer = document.querySelector('.searchContainer');
    const searchInput = document.querySelector('.searchInput input');
    const clearSearchButton = document.querySelector('.clearSearch');
    const playingPlaylistContainer = document.querySelector('.playingPlaylistContainer');
    let searchTimer = null;
    const SEARCH_TIMEOUT = 3000; // 3 seconds timeout for hiding

    // Function to show header and mainNav
    function showSearch() {
        header.style.transform = 'translateY(0)';
        mainNav.style.transform = 'translateY(0)';
        mainNav.classList.remove('hidden'); // Remove hidden class
        searchContainer.style.display = 'flex';
        searchInput.focus();
        searchButton.style.filter = "brightness(1.5)";
        searchIcon.src = "/Images/searchOn.svg"
        searchIcon.style.opacity = "1";
        searchIcon.style.width = "24px";
        searchIcon.style.height = "24px";
    }

    // Function to hide header only
    function hideHeader() {
        // First ensure mainNav is visible
        mainNav.style.transform = 'translateY(0)';
        mainNav.classList.remove('hidden');
        
        // Then hide header
        header.style.transform = 'translateY(-100%)';
        searchContainer.style.display = 'none';
        searchInput.blur();
        searchButton.style.filter = "brightness(1.5)";
        searchIcon.src = "/Images/searchOn.svg"
        searchIcon.style.opacity = "1";
        searchIcon.style.width = "24px";
        searchIcon.style.height = "24px";
    }

    // Function to hide both header and mainNav
    function hideBoth() {
        header.style.transform = 'translateY(-100%)';
        searchContainer.style.display = 'none';
        searchInput.blur(); // Remove focus
        searchButton.style.filter = "brightness(1)";
        searchIcon.src = "/Images/searchOff.svg"
        searchIcon.style.opacity = "0.7";
        searchIcon.style.width = "24px";
        searchIcon.style.height = "24px";
    }

    // Function to start hide timer
    function startHideTimer() {
        if (searchTimer) clearTimeout(searchTimer);
        
        if (searchInput.value.trim()) {
            // If there's text, only hide header
            searchTimer = setTimeout(hideHeader, SEARCH_TIMEOUT);
        } else {
            // If no text, hide both
            searchTimer = setTimeout(hideBoth, SEARCH_TIMEOUT);
        }
    }



    // Function to search within playing playlist
    function searchInPlayingPlaylist(searchTerm) {
        if (!playingPlaylistContainer || !playingPlaylistContainer.classList.contains('active')) return;

        const songItems = playingPlaylistContainer.querySelectorAll('.songLi');
        const searchTermLower = searchTerm.toLowerCase();

        songItems.forEach(songItem => {
            const songName = songItem.querySelector('.info p:first-child a').textContent.toLowerCase();
            const artistName = songItem.querySelector('.info p:last-child').textContent.toLowerCase();
            
            if (songName.includes(searchTermLower) || artistName.includes(searchTermLower)) {
                songItem.style.display = 'flex';
            } else {
                songItem.style.display = 'none';
            }
        });
    }

    // Handle search button click
    searchButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showSearch();
        startHideTimer();
    });

    // Handle search input interactions
    searchInput.addEventListener('focus', () => {
        if (searchTimer) clearTimeout(searchTimer);
        // Ensure both are visible when input is focused
        header.style.transform = 'translateY(0)';
        mainNav.style.transform = 'translateY(0)';
        mainNav.classList.remove('hidden');
        searchButton.style.filter = "brightness(1.5)";
        searchIcon.src = "/Images/searchOn.svg"
        searchIcon.style.opacity = "1";
        searchIcon.style.width = "24px";
        searchIcon.style.height = "24px";
    });

    searchInput.addEventListener('blur', () => {
        startHideTimer();
        searchButton.style.filter = "brightness(1.5)";
        searchIcon.src = "/Images/searchOn.svg"
        searchIcon.style.opacity = "1";
        searchIcon.style.width = "24px";
        searchIcon.style.height = "24px";
    });

    // Handle search input changes
    searchInput.addEventListener('input', () => {
        // Clear any existing timer
        if (searchTimer) clearTimeout(searchTimer);
        
        const searchTerm = searchInput.value.trim();
        
        // Show/hide clear button based on input
        if (searchTerm) {
            clearSearchButton.style.display = 'block';
            // Keep mainNav visible when typing
            mainNav.style.transform = 'translateY(0)';
            mainNav.classList.remove('hidden');
            header.style.transform = 'translateY(0)';
            
            // Search within playing playlist if it's open
            searchInPlayingPlaylist(searchTerm);
            
            // Start timer to hide only header
            searchTimer = setTimeout(hideHeader, SEARCH_TIMEOUT);
        } else {
            clearSearchButton.style.display = 'none';
            
            // Show all songs if playing playlist is open
            if (playingPlaylistContainer && playingPlaylistContainer.classList.contains('active')) {
                const songItems = playingPlaylistContainer.querySelectorAll('.songLi');
                songItems.forEach(item => item.style.display = 'flex');
            }
            
            // Start timer to hide both
            searchTimer = setTimeout(hideBoth, SEARCH_TIMEOUT);
        }
    });

    // Handle clear search button click
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchButton.style.display = 'none';
        searchInput.focus();
        
        // Show all songs if playing playlist is open
        if (playingPlaylistContainer && playingPlaylistContainer.classList.contains('active')) {
            const songItems = playingPlaylistContainer.querySelectorAll('.songLi');
            songItems.forEach(item => item.style.display = 'flex');
        }
        
        // Start timer to hide both since input is now empty
        searchTimer = setTimeout(hideBoth, SEARCH_TIMEOUT);
    });

    // Handle document clicks to hide search when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target) && !searchButton.contains(e.target)) {
            if (!searchInput.value.trim()) {
                hideBoth();
            } else {
                hideHeader();
            }
        }
    });

    // Handle escape key to hide search
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!searchInput.value.trim()) {
                hideBoth();
            } else {
                // If there's text, just clear it and hide both
                searchInput.value = '';
                clearSearchButton.style.display = 'none';
                
                // Show all songs if playing playlist is open
                if (playingPlaylistContainer && playingPlaylistContainer.classList.contains('active')) {
                    const songItems = playingPlaylistContainer.querySelectorAll('.songLi');
                    songItems.forEach(item => item.style.display = 'flex');
                }
                
                searchTimer = setTimeout(hideBoth, SEARCH_TIMEOUT);
            }
        }
    });
}

function MobileLibraryEvents() {
    const libraryButton = document.querySelector('.mainNav button:nth-child(3)');
    const libraryIcon = libraryButton.querySelector('img');
    const homeButton = document.querySelector('.mainNav button:nth-child(1)');
    const homeIcon = homeButton.querySelector('img');
    const libraryContainer = document.querySelector('.libraryContainer');
    const playingPlaylistContainer = document.querySelector('.playingPlaylistContainer');
    const centerContainer = document.querySelector('.centerContainer');
    const collapseButton = libraryContainer.querySelector('.collapse');

    // Show library (hide center container)
    function showLibrary() {
        const header = document.querySelector('.headerContainer2');
        if (header) {
            header.style.transform = 'translateY(0)';
            header.style.transition = 'transform 0.3s ease';
        }
        libraryContainer.classList.add('active');
        centerContainer.style.display = 'none';
        libraryButton.classList.add('active');
        homeButton.classList.remove('active');
        document.body.style.overflow = 'hidden';
        homeIcon.src = "/Images/homeOff.svg"
        libraryIcon.src = "/Images/libraryMon.svg"
    }

    // Show home (hide library container)
    function showHome() {
        if (playingPlaylistContainer.classList.contains('active')) {
            const header = document.querySelector('.headerContainer2');
            if (header) {
                header.style.transform = 'translateY(-100%)';
                header.style.transition = 'transform 0.3s ease';
            }
        }
        libraryContainer.classList.remove('active');
        centerContainer.style.display = 'block';
        homeButton.classList.add('active');
        libraryButton.classList.remove('active');
        document.body.style.overflow = '';
        homeIcon.src = "/Images/homeOn.svg"
    }

    // Library button click
    libraryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showLibrary();
    });

    // Home button click
    homeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showHome();
    });

    // Collapse button click
    collapseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showHome();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!libraryContainer.contains(e.target) && 
            e.target !== libraryButton && 
            e.target !== homeButton) {
            showHome();
        }
    });
}


// Main function
async function main() {

    // Get all music data from server
    allMusicData = await getAllMusicData();
    console.log("Server music data:", allMusicData);

    // Create our custom groups and playlists
    const meditation = createGroupWithPlaylists("Meditation", ["Calm your mind!","Focus on your work!", "I am Leader!"]);
    const mixCulture = createGroupWithPlaylists("Mix Culture", ["Punjabi Hits", "Hindi Hits", "English Hits"]);
    const popularartists = createGroupWithPlaylists("Popular artist", ["Karan Aujla", "Diljit Dosanjh", "One Direction", "Zayn", "Ankit Tiwari", "Shubh", "Taylor Swift", "Daya", "Yo Yo Honey Singh", "Pritam", "Ed Sheeran", "Guru Randhawa", "Charlie Puth"]);
    const english = createGroupWithPlaylists("English", ["PILLOWTALK", "Shape Of You", "What Makes You Beautiful", "Bye Bye Bye", "Attention", "One Love", "Baby", "Jalebi Baby", "Down","Superman", "Yummy", "Don't let me down"]);
    const hindi = createGroupWithPlaylists("Hindi", ["Bang Bang", "Malang", "Tu Hai Ki Nahi", "Kamli"]);
    const punjabi = createGroupWithPlaylists("Punjabi", ["Wavy", "Winning Speech", "Zulfa", "Proper Patola", "Amplifier"]);
    const album = createGroupWithPlaylists("Album", ["Album 1", "Album 2", "Album 3"]);

    // Add our custom groups to allMusicData
    allMusicData.push(meditation, popularartists, mixCulture, english, hindi, punjabi,album);


    //Meditation
    addSongToPlaylist("Calm your mind!", "S.T.A.Y.", "Hans Zimmer");
    addSongToPlaylist("Calm your mind!", "Arrival of the Birds", "The Cinematic Orchestra");
    addSongToPlaylist("Calm your mind!", "Now We are Free", "Hans Zimmer");

    //Single Songs
    //English
    addSongToPlaylist("PILLOWTALK", "PILLOWTALK", "ZAYN");
    addSongToPlaylist("Shape Of You", "Shape of You", "Ed Sheeran");
    addSongToPlaylist("What Makes You Beautiful", "What Makes you Beautiful", "One Direction");
    addSongToPlaylist("Bye Bye Bye", "Bye Bye Bye", "*NSYNC");
    addSongToPlaylist("Attention", "Attention", "Charlie Puth");
    addSongToPlaylist("One Love", "One Love", "Blue");
    addSongToPlaylist("Baby", "Baby", "Justin Bieber");
    addSongToPlaylist("Jalebi Baby", "Jalebi baby", "Tesher");
    addSongToPlaylist("Down", "Down", "Jay Sean");
    addSongToPlaylist("Superman", "Superman", "Eminem");
    addSongToPlaylist("Yummy", "Yummy", "Justin Bieber");
    addSongToPlaylist("Don't let me down", "Don't let me down", "The Chainsmokers");
    addSongToPlaylist("Superman", "Superman", "Eminem");

    //Hindi
    addSongToPlaylist("Bang Bang", "Bang Bang", "Vishal Shekhar");
    addSongToPlaylist("Malang", "Malang", "Siddharth Mahadevan");
    addSongToPlaylist("Tu Hai Ki Nahi", "Tu Hai Ki Nahi", "Ankit Tiwari");
    addSongToPlaylist("Kamli", "Kamli", "Sunidhi Chauhan");

    //Punjabi
    addSongToPlaylist("Wavy", "Wavy", "Karan Aujla");
    addSongToPlaylist("Winning Speech", "Winning Speech", "Karan Aujla");
    addSongToPlaylist("Zulfa", "Zulfa", "Jaz Dhami");
    addSongToPlaylist("Proper Patola", "Proper Patola", "Diljit Dosanjh");
    addSongToPlaylist("Amplifier", "Amplifier", "Imran Khan");
    addSongToPlaylist("Millionaire Song", "Millionaire Song", "Yo Yo Honey Singh");

    //Popular Artists
    //Karan Aujla
    addSongToPlaylist("Karan Aujla", "Wavy", "Karan Aujla");
    addSongToPlaylist("Karan Aujla", "Winning Speech", "Karan Aujla");

    //Diljit Dosanjh
    addSongToPlaylist("Diljit Dosanjh", "Proper Patola", "Diljit Dosanjh");

    //One Direction
    addSongToPlaylist("One Direction", "What Makes you Beautiful", "One Direction");

    //Zayn
    addSongToPlaylist("Zayn", "PILLOWTALK", "Zayn");

    //Ankit Tiwari
    addSongToPlaylist("Ankit Tiwari", "Tu Hai Ki Nahi", "Ankit Tiwari");



    //Punjabi Hits
    addSongToPlaylist("Punjabi Hits","Wavy","Karan Aujla");
    addSongToPlaylist("Punjabi Hits", "Winning Speech", "Karan Aujla");
    addSongToPlaylist("Punjabi Hits", "Zulfa", "Jaz Dhami");
    addSongToPlaylist("Punjabi Hits", "Proper Patola", "Diljit Dosanjh");
    addSongToPlaylist("Punjabi Hits", "Amplifier", "Imran Khan");
    addSongToPlaylist("Punjabi Hits", "Millionaire Song", "Yo Yo Honey Singh");
    //English Hits
    addSongToPlaylist("English Hits", "What Makes you Beautiful", "One Direction");
    addSongToPlaylist("English Hits", "Pillowtalk", "Zayn");
    addSongToPlaylist("English Hits", "Shape of You", "Ed Sheeran");
    addSongToPlaylist("English Hits", "Bye Bye Bye", "*NSYNC");
    addSongToPlaylist("English Hits","Attention", "Charlie Puth");
    addSongToPlaylist("English Hits", "One Love", "Blue");
    addSongToPlaylist("English Hits", "Baby", "Justin Bieber");
    addSongToPlaylist("English Hits", "Jalebi baby", "Tesher");
    addSongToPlaylist("English Hits", "Down", "Jay Sean");
    addSongToPlaylist("English Hits", "Superman", "Eminem");
    addSongToPlaylist("English Hits", "Yummy", "Justin Bieber");
    addSongToPlaylist("English Hits", "Don't let me down", "The Chainsmokers");
    //Hindi Hits
    addSongToPlaylist("Hindi Hits", "Bang Bang", "Vishal Shekhar");
    addSongToPlaylist("Hindi Hits", "Malang", "Siddharth Mahadevan");
    addSongToPlaylist("Hindi Hits", "Tu Hai Ki Nahi", "Ankit Tiwari");
    addSongToPlaylist("Hindi Hits", "Kamli", "Sunidhi Chauhan");


    // Shuffle groups
    const shuffledGroups = shuffleArray([...allMusicData]);

    // Shuffle playlists within each group
    shuffledGroups.forEach(group => {
        group.playlists = shuffleArray([...group.playlists]);
    });

    // Render all groups with shuffled order
    renderGroups(shuffledGroups);

    //Render all Songs from Playlist
    renderSongsFromPlaylist(shuffledGroups);


    
    // Initialize all button events
    console.log("Initializing button events...");

    //Toggle PlayBar Button
    attachPlayBarButtonEvents();
    console.log("PlayBar button events attached");

    //Toggle Playlist Button
    attachPlaylistButtonEvents();
    console.log("Playlist button events attached");

    //Call Seekbar
    attachSeekBarEvents();
    console.log("Seekbar events attached");

    //Call Previous Button
    attachPreviousButtonEvents();
    console.log("Previous button events attached");

    //Call Next Button
    attachNextButtonEvents();
    console.log("Next button events attached");

    //Call Volume
    attachVolumeBarEvents();
    console.log("Volume events attached");

    //Call Shuffle Button
    attachShuffleButtonEvents();
    console.log("Shuffle button events attached");

    //Call Automatic Next Song
    attachAutomaticNextSongEvents();
    console.log("Automatic next song events attached");

    //Call Repeat Button
    attachRepeatButtonEvents();
    console.log("Repeat button events attached");

    //Search Input Button
    attachSearchEvents();

    // Add sidebar navigation events
    attachSidebarEvents();
    console.log("Sidebar events attached");

    // Add collapse button events
    attachCollapseButtonEvents();
    console.log("Collapse button events attached");

    // Call Full Screen Button
    attachFullScreenButtonEvents();
    console.log("Full screen button events attached");

    // Attach fullscreen controls events
    attachFullScreenControlsEvents();

    // Add mobile search events
    if (window.innerWidth <= 768) {
        MobileSearchEvents();
        MobileLibraryEvents();
    }

}

main()

// Add this function to set initial active state
function setInitialFilterState() {
    // Set initial active filter color
    document.documentElement.style.setProperty('--active-filter-color', 'white');
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', setInitialFilterState);




