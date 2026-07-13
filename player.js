'use strict';
/* ============================================================
   CHARLIE PUTH — DATABASE CURATOR DASHBOARD
   Engine v4.0 (Zero-dependency hybrid playback & direct save API)
   ============================================================ */

window.onYouTubeIframeAPIReady = function() {
  if (window.dashboardInstance) {
    window.dashboardInstance._buildYTPlayer();
  }
};

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

class CurationDashboard {
  constructor() {
    this.songs = [];
    this.currentIdx = -1;
    this.isPlaying = false;
    this.activeFilter = 'all'; // 'all' | 'unreviewed' | 'kept' | 'cut' | 'duplicates'
    this.searchQ = '';
    
    // Playback volumes
    this.volume = 0.8;
    this.isMuted = false;

    // Audio elements
    this.audio = new Audio();
    this.audio.volume = this.volume;
    
    // YT elements
    this.ytPlayer = null;
    this.ytReady = false;
    this.ytProgressInterval = null;

    // Drag / UI
    this.dragDepth = 0;
    this.draggingProg = false;

    window.dashboardInstance = this;
    this.init();
  }

  init() {
    this._cacheEls();
    this._loadSongs();
    this._bindEvents();
    this._initYouTubePlayer();
    this._updateUIState();
  }

  _cacheEls() {
    const $ = id => document.getElementById(id);
    this.el = {
      // Metrics
      valReviewed:      $('valReviewed'),
      valKept:          $('valKept'),
      valCut:           $('valCut'),
      valProgressFill:  $('valProgressFill'),
      btnSaveDB:        $('btnSaveDB'),
      
      // Toolbar
      cntAll:           $('cntAll'),
      cntUnreviewed:    $('cntUnreviewed'),
      cntKept:          $('cntKept'),
      cntCut:           $('cntCut'),
      cntDupes:         $('cntDupes'),
      searchInput:      $('searchInput'),
      btnAddTrack:      $('btnAddTrack'),
      btnUploadFile:    $('btnUploadFile'),
      
      // Table
      tableBody:        $('tableBody'),
      
      // Floating Player
      playerWidget:     $('playerWidget'),
      fpTitle:          $('fpTitle'),
      fpCloseBtn:       $('fpCloseBtn'),
      fpCurrentTime:    $('fpCurrentTime'),
      fpTrack:          $('fpTrack'),
      fpFill:           $('fpFill'),
      fpTotalTime:      $('fpTotalTime'),
      fpPrevBtn:        $('fpPrevBtn'),
      fpPlayBtn:        $('fpPlayBtn'),
      fpNextBtn:        $('fpNextBtn'),
      fpVolumeSlider:   $('fpVolumeSlider'),
      
      // Add Modal
      addTrackModal:    $('addTrackModal'),
      modalClose:       $('modalClose'),
      modalUrl:         $('modalUrl'),
      modalTitle:       $('modalTitle'),
      modalCancel:      $('modalCancel'),
      modalAdd:         $('modalAdd'),
      
      // File upload & Drag
      fileInput:        $('fileInput'),
      dragOverlay:      $('dragOverlay')
    };
  }

  _loadSongs() {
    if (typeof INITIAL_SONGS !== 'undefined' && Array.isArray(INITIAL_SONGS)) {
      // Map initial state if not defined inside JSON objects
      this.songs = INITIAL_SONGS.map(song => ({
        ...song,
        kept: !!song.kept,
        cut: !!song.cut,
        favorite: !!song.favorite
      }));
    }
  }

  _bindEvents() {
    const e = this.el;

    // Filter Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeFilter = tab.dataset.filter;
        this._renderTable();
      });
    });

    // Search query
    e.searchInput.addEventListener('input', ev => {
      this.searchQ = ev.target.value.toLowerCase();
      this._renderTable();
    });

    // Save DB Trigger (POST request to local node backend server)
    e.btnSaveDB.addEventListener('click', () => this._saveToDatabaseFile());

    // Add track modal
    e.btnAddTrack.addEventListener('click', () => this._openModal());
    e.btnUploadFile.addEventListener('click', () => e.fileInput.click());
    e.fileInput.addEventListener('change', () => {
      if (e.fileInput.files.length) this._handleLocalUploads([...e.fileInput.files]);
    });
    e.modalClose.addEventListener('click', () => this._closeModal());
    e.modalCancel.addEventListener('click', () => this._closeModal());
    e.modalAdd.addEventListener('click', () => this._addTrackLink());
    e.modalUrl.addEventListener('keydown', ev => { if (ev.key === 'Enter') this._addTrackLink(); });

    // File Drag and Uploads
    document.body.addEventListener('dragenter', ev => {
      ev.preventDefault();
      this.dragDepth++;
      e.dragOverlay.classList.add('show');
    });
    document.body.addEventListener('dragleave', ev => {
      ev.preventDefault();
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) e.dragOverlay.classList.remove('show');
    });
    document.body.addEventListener('dragover', ev => ev.preventDefault());
    document.body.addEventListener('drop', ev => {
      ev.preventDefault();
      this.dragDepth = 0;
      e.dragOverlay.classList.remove('show');
      const files = [...ev.dataTransfer.files].filter(f => f.type.startsWith('audio/') || /\.(mp3|flac|wav|ogg|m4a)$/i.test(f.name));
      if (files.length) this._handleLocalUploads(files);
    });

    // Floating Player Events
    e.fpCloseBtn.addEventListener('click', () => { e.playerWidget.style.display = 'none'; });
    e.fpPlayBtn.addEventListener('click', () => this._togglePlay());
    e.fpPrevBtn.addEventListener('click', () => this._playPrev());
    e.fpNextBtn.addEventListener('click', () => this._playNext());
    e.fpVolumeSlider.addEventListener('input', ev => this._setVolume(ev.target.value / 100));

    // Audio progress row
    this.audio.addEventListener('timeupdate', () => {
      if (this.currentIdx !== -1 && !this.songs[this.currentIdx].youtubeId) {
        this._onTimeUpdate();
      }
    });
    this.audio.addEventListener('ended', () => {
      if (this.currentIdx !== -1 && !this.songs[this.currentIdx].youtubeId) {
        this._onEnded();
      }
    });
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.currentIdx !== -1 && !this.songs[this.currentIdx].youtubeId) {
        e.fpTotalTime.textContent = formatTime(this.audio.duration);
      }
    });

    e.fpTrack.addEventListener('mousedown', ev => { this.draggingProg = true; this._seekFromEv(ev); });
    document.addEventListener('mousemove', ev => { if (this.draggingProg) this._seekFromEv(ev); });
    document.addEventListener('mouseup', () => { this.draggingProg = false; });
    e.fpTrack.addEventListener('click', ev => this._seekFromEv(ev));

    // Spacebar to pause shortcut
    document.addEventListener('keydown', ev => {
      if (ev.target.tagName === 'INPUT') return;
      if (ev.code === 'Space') {
        ev.preventDefault();
        this._togglePlay();
      }
    });
  }

  /* ---- YT AUDIO STREAM BUILDER ---- */
  _initYouTubePlayer() {
    if (window.YT && window.YT.Player) {
      this._buildYTPlayer();
    }
  }

  _buildYTPlayer() {
    if (this.ytReady) return;
    this.ytPlayer = new YT.Player('ytPlayer', {
      height: '0',
      width: '0',
      videoId: '',
      playerVars: {
        playsinline: 1,
        disablekb: 1,
        fs: 0,
        rel: 0,
        controls: 0
      },
      events: {
        onReady: () => {
          this.ytReady = true;
          this.ytPlayer.setVolume(this.volume * 100);
        },
        onStateChange: (event) => {
          this._onYTStateChange(event);
        }
      }
    });
  }

  _onYTStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      this._setPlayEffects(true);
      this._startYTProgressTimer();

      // Grab real duration from YT player and patch the song + UI.
      // The hardcoded 180 s placeholder is wrong for short/long clips.
      if (this.currentIdx !== -1 && this.ytPlayer && this.ytPlayer.getDuration) {
        const realDur = this.ytPlayer.getDuration();
        if (realDur && realDur > 0) {
          const song = this.songs[this.currentIdx];
          if (song && Math.abs(song.duration - realDur) > 2) {
            song.duration = realDur;
            this.el.fpTotalTime.textContent = formatTime(realDur);
            // Persist the corrected duration so we don't show 3:00 next reload
            this._saveToDatabaseFile();
          }
        }
      }

    } else if (event.data === YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      this._setPlayEffects(false);
      this._stopYTProgressTimer();
    } else if (event.data === YT.PlayerState.ENDED) {
      this.isPlaying = false;
      this._stopYTProgressTimer();
      this._onEnded();
    }
  }

  _startYTProgressTimer() {
    this._stopYTProgressTimer();
    this.ytProgressInterval = setInterval(() => {
      if (this.ytReady && this.ytPlayer.getCurrentTime) {
        const cur = this.ytPlayer.getCurrentTime();
        const dur = this.ytPlayer.getDuration() || 0;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        if (!this.draggingProg) {
          this.el.fpCurrentTime.textContent = formatTime(cur);
          this.el.fpFill.style.width = `${pct}%`;
        }
      }
    }, 250);
  }

  _stopYTProgressTimer() {
    if (this.ytProgressInterval) {
      clearInterval(this.ytProgressInterval);
      this.ytProgressInterval = null;
    }
  }

  /* ---- LOCAL FILE AND LINK ADDITIONS ---- */
  async _handleLocalUploads(files) {
    const saveBtn = this.el.btnSaveDB;
    const oldText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'UPLOADING...';

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let base = f.name.replace(/\.[^.]+$/,'').trim();
      const dash = base.indexOf(' - ');
      let title = base;
      if (dash !== -1) title = base.slice(dash+3).trim();

      try {
        const response = await fetch(`/api/upload?name=${encodeURIComponent(f.name)}`, {
          method: 'POST',
          body: f
        });
        const data = await response.json();
        
        if (data.url) {
          const song = {
            id: Date.now() + i + Math.random(),
            title,
            artist: 'Charlie Puth',
            url: data.url,
            duration: 0,
            kept: false,
            cut: false,
            favorite: false,
            letter: (title[0] || '?').toUpperCase()
          };
          this.songs.push(song);
          this._loadDuration(song);
        }
      } catch(err) {
        console.error('Local upload failed:', err);
        alert(`Failed to upload ${f.name}: ${err.message}`);
      }
    }

    saveBtn.disabled = false;
    saveBtn.textContent = oldText;
    this.el.fileInput.value = '';
    this._updateUIState();
  }

  _loadDuration(song) {
    const tmp = new Audio();
    tmp.src = song.url;
    tmp.addEventListener('loadedmetadata', () => {
      song.duration = tmp.duration;
      this._renderTable();
      tmp.src = '';
    }, { once: true });
    tmp.load();
  }

  _openModal() {
    this.el.modalUrl.value = '';
    this.el.modalTitle.value = '';
    this.el.addTrackModal.classList.add('open');
    setTimeout(() => this.el.modalUrl.focus(), 80);
  }

  _closeModal() {
    this.el.addTrackModal.classList.remove('open');
  }

  _addTrackLink() {
    let url = this.el.modalUrl.value.trim();
    let titleInput = this.el.modalTitle.value.trim();
    if (!url) return;

    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

    // Smart input-swap detection: if user pasted the URL in the Title box and typed name in URL box
    const urlLooksLikeTitle = !url.startsWith('http') && !url.includes('/') && !url.match(ytRegex);
    const titleLooksLikeUrl = titleInput.startsWith('http') || titleInput.includes('/') || titleInput.match(ytRegex);
    
    if (urlLooksLikeTitle && titleLooksLikeUrl) {
      const temp = url;
      url = titleInput;
      titleInput = temp;
    }

    let youtubeId = null;
    const match = url.match(ytRegex);
    if (match) youtubeId = match[1];

    const urlTitle = url.split('/').pop().replace(/\?.*$/,'').replace(/\.[^.]+$/,'').replace(/_|-/g,' ').trim() || 'Custom Stream';
    const title = titleInput || urlTitle;

    const song = {
      id: youtubeId || Date.now() + Math.random(),
      title,
      artist: 'Charlie Puth',
      url: youtubeId ? '' : url,
      youtubeId,
      fromFile: false,
      duration: youtubeId ? 180 : 0,
      kept: false,
      cut: false,
      favorite: false,
      letter: (title[0] || '?').toUpperCase()
    };

    this.songs.push(song);
    if (!youtubeId) this._loadDuration(song);
    this._closeModal();
    this._updateUIState();
    this._saveToDatabaseFile();
  }

  /* ---- CURATION OPERATIONS ---- */
  _curateKeep(idx) {
    const song = this.songs[idx];
    if (!song) return;
    
    song.kept = !song.kept;
    if (song.kept) song.cut = false; // toggle cut off if kept
    
    this._updateUIState();
    this._saveToDatabaseFile();
  }

  _curateCut(idx) {
    const song = this.songs[idx];
    if (!song) return;

    song.cut = !song.cut;
    if (song.cut) song.kept = false; // toggle keep off if cut

    this._updateUIState();
    this._saveToDatabaseFile();
  }

  _deleteSongRow(idx) {
    if (confirm('Delete this track from the database? This cannot be undone.')) {
      this.songs.splice(idx, 1);
      this._updateUIState();
      this._saveToDatabaseFile();
    }
  }

  _onTitleChange(idx, val) {
    const song = this.songs[idx];
    if (song) {
      song.title = val; // preserve raw spacing while typing
    }
  }

  _onTitleBlur(idx, val) {
    const song = this.songs[idx];
    if (song) {
      song.title = val.trim();
      song.letter = (song.title[0] || '?').toUpperCase();
      this._updateUIState();
      this._saveToDatabaseFile();
    }
  }

  /* ---- PLAYBACK ENGINE ---- */
  async _playSong(idx) {
    if (idx < 0 || idx >= this.songs.length) return;

    if (this.currentIdx !== -1) {
      const prev = this.songs[this.currentIdx];
      if (prev.youtubeId && this.ytReady) this.ytPlayer.pauseVideo();
      else this.audio.pause();
    }

    this.currentIdx = idx;
    const song = this.songs[idx];

    // Build Floating Widget UI
    this.el.playerWidget.style.display = 'block';
    this.el.fpTitle.textContent = song.title;
    this.el.fpTotalTime.textContent = formatTime(song.duration);
    this.el.fpCurrentTime.textContent = '0:00';
    this.el.fpFill.style.width = '0%';

    // Playback
    if (song.youtubeId) {
      if (this.ytReady) {
        this.ytPlayer.loadVideoById(song.youtubeId);
        this.ytPlayer.setVolume(this.volume * 100);
        if (this.isMuted) this.ytPlayer.mute();
        else this.ytPlayer.unMute();
      }
    } else {
      this.audio.src = song.url;
      this.audio.volume = this.isMuted ? 0 : this.volume;
      try {
        await this.audio.play();
        this.isPlaying = true;
        this._setPlayEffects(true);
      } catch (err) {
        console.error('Local Audio playback error:', err);
        this.isPlaying = false;
        this._setPlayEffects(false);
      }
    }

    this._renderTable();
  }

  _togglePlay() {
    if (this.currentIdx === -1) return;
    const song = this.songs[this.currentIdx];

    if (song.youtubeId) {
      if (this.ytReady) {
        if (this.isPlaying) {
          this.ytPlayer.pauseVideo();
          this.isPlaying = false;
          this._setPlayEffects(false);
        } else {
          this.ytPlayer.playVideo();
          this.isPlaying = true;
          this._setPlayEffects(true);
        }
      }
    } else {
      if (this.isPlaying) {
        this.audio.pause();
        this.isPlaying = false;
        this._setPlayEffects(false);
      } else {
        this.audio.play();
        this.isPlaying = true;
        this._setPlayEffects(true);
      }
    }
    this._renderTable();
  }

  _setPlayEffects(playing) {
    const playBtn = this.el.fpPlayBtn;
    playBtn.querySelector('.play-svg').style.display = playing ? 'none' : '';
    playBtn.querySelector('.pause-svg').style.display = playing ? '' : 'none';
  }

  _playNext() {
    if (!this.songs.length) return;
    // Navigate within the currently visible sorted list, not the raw master array
    const visibleList = this._getFilteredSongs();
    if (!visibleList.length) return;
    const curVisIdx = visibleList.findIndex(s => this.songs.indexOf(s) === this.currentIdx);
    const nextVis = (curVisIdx + 1) % visibleList.length;
    this._playSong(this.songs.indexOf(visibleList[nextVis]));
  }

  _playPrev() {
    if (!this.songs.length) return;
    const visibleList = this._getFilteredSongs();
    if (!visibleList.length) return;
    const curVisIdx = visibleList.findIndex(s => this.songs.indexOf(s) === this.currentIdx);
    const prevVis = (curVisIdx - 1 + visibleList.length) % visibleList.length;
    this._playSong(this.songs.indexOf(visibleList[prevVis]));
  }

  _onEnded() {
    this._playNext();
  }

  /* ---- SEEKING ---- */
  _onTimeUpdate() {
    if (this.draggingProg) return;
    const cur = this.audio.currentTime;
    const dur = this.audio.duration || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    this.el.fpCurrentTime.textContent = formatTime(cur);
    this.el.fpFill.style.width = `${pct}%`;
  }

  _seekFromEv(ev) {
    if (this.currentIdx === -1) return;
    const song = this.songs[this.currentIdx];
    const rect = this.el.fpTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));

    if (song.youtubeId) {
      if (this.ytReady && this.ytPlayer.getDuration) {
        const dur = this.ytPlayer.getDuration();
        this.ytPlayer.seekTo(pct * dur, true);
        this.el.fpFill.style.width = `${pct*100}%`;
        this.el.fpCurrentTime.textContent = formatTime(pct * dur);
      }
    } else {
      const dur = this.audio.duration || 0;
      this.audio.currentTime = pct * dur;
    }
  }

  _setVolume(v) {
    this.volume = v;
    this.isMuted = (v === 0);
    this.audio.volume = v;

    if (this.ytPlayer && this.ytReady && this.ytPlayer.setVolume) {
      this.ytPlayer.setVolume(v * 100);
      if (this.isMuted) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    }
  }

  _toggleMute() {
    this.isMuted = !this.isMuted;
    this._setVolume(this.isMuted ? 0 : this.volume);
    this.el.fpVolumeSlider.value = this.isMuted ? 0 : this.volume * 100;
  }

  /* ---- DATABASE SAVER (POST to Local Server) ---- */
  async _saveToDatabaseFile() {
    const saveBtn = this.el.btnSaveDB;
    saveBtn.disabled = true;
    saveBtn.textContent = 'SAVING...';

    // Strip volatile runtime states (blobs) if present
    const cleanSongs = this.songs.map(song => {
      const clean = { ...song };
      if (clean.fromFile) {
        delete clean.url; // remove temporary blob url before saving
      }
      return clean;
    });

    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanSongs)
      });
      const data = await response.json();
      if (data.success) {
        saveBtn.style.background = '#22c55e';
        saveBtn.style.color = '#fff';
        saveBtn.textContent = 'DATABASE SAVED!';
        setTimeout(() => {
          saveBtn.style.background = '';
          saveBtn.style.color = '';
          saveBtn.textContent = 'SAVE TO DATABASE';
          saveBtn.disabled = false;
        }, 1500);
      } else {
        throw new Error(data.error || 'Server rejected request');
      }
    } catch(err) {
      console.error('Save failed:', err);
      alert('Failed to save changes: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE TO DATABASE';
    }
  }

  /* ---- FILTER COMPILATION ---- */
  _getFilteredSongs() {
    // CRITICAL: Always work on a COPY so .sort() never mutates this.songs.
    // Mutating this.songs would scramble the master indices that Keep/Cut/Delete/Play all depend on.
    let list = this.songs.slice();

    // Search Box query (split query by whitespace, check word-boundary match for title, substring for ID)
    if (this.searchQ) {
      const terms = this.searchQ.split(/\s+/).filter(t => t.length > 0);
      if (terms.length > 0) {
        list = list.filter(s => {
          const titleLower = s.title.toLowerCase();
          const ytIdLower = (s.youtubeId || '').toLowerCase();
          
          return terms.every(term => {
            const escTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const wordBoundRegex = new RegExp('\\b' + escTerm, 'i');
            return wordBoundRegex.test(titleLower) || ytIdLower.includes(term);
          });
        });
      }
    }

    // Curation Filters
    if (this.activeFilter === 'unreviewed') {
      list = list.filter(s => !s.kept && !s.cut);
    } else if (this.activeFilter === 'kept') {
      list = list.filter(s => s.kept);
    } else if (this.activeFilter === 'cut') {
      list = list.filter(s => s.cut);
    } else if (this.activeFilter === 'duplicates') {
      const idsSeen = new Set();
      const dupIds = new Set();
      // BUG FIX: store the song OBJECT (not s.id) so we can do firstSong.id below
      const cleanTitlesSeen = new Map(); // clean title -> first song object

      this.songs.forEach(s => {
        // Exact YouTube ID duplicates
        if (s.youtubeId) {
          if (idsSeen.has(s.youtubeId)) {
            dupIds.add(s.id);
            const first = this.songs.find(x => x.youtubeId === s.youtubeId && x !== s);
            if (first) dupIds.add(first.id);
          } else {
            idsSeen.add(s.youtubeId);
          }
        }
        
        // Similar title duplicates (normalised)
        const norm = s.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm.length > 3) {
          if (cleanTitlesSeen.has(norm)) {
            dupIds.add(s.id);
            const firstSong = cleanTitlesSeen.get(norm); // now a song object
            dupIds.add(firstSong.id);
          } else {
            cleanTitlesSeen.set(norm, s); // store song object, not s.id
          }
        }
      });

      list = list.filter(s => dupIds.has(s.id));
    }

    // Sort the copy — never the master array
    if (this.activeFilter === 'duplicates') {
      list.sort((a, b) => {
        const normA = a.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normB = b.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const comp = normA.localeCompare(normB);
        if (comp !== 0) return comp;
        return String(a.id).localeCompare(String(b.id));
      });
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }

  _updateUIState() {
    const all = this.songs.length;
    const kept = this.songs.filter(s => s.kept).length;
    const cut = this.songs.filter(s => s.cut).length;
    const unreviewed = this.songs.filter(s => !s.kept && !s.cut).length;
    
    // Duplicate count — store song OBJECTS in cleanTitlesSeen
    const idsSeen = new Set();
    const dupIds = new Set();
    const cleanTitlesSeen = new Map(); // norm -> song object
    this.songs.forEach(s => {
      if (s.youtubeId) {
        if (idsSeen.has(s.youtubeId)) {
          dupIds.add(s.id);
          const first = this.songs.find(x => x.youtubeId === s.youtubeId && x !== s);
          if (first) dupIds.add(first.id);
        } else {
          idsSeen.add(s.youtubeId);
        }
      }
      const norm = s.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.length > 3) {
        if (cleanTitlesSeen.has(norm)) {
          dupIds.add(s.id);
          const firstSong = cleanTitlesSeen.get(norm);
          dupIds.add(firstSong.id);
        } else {
          cleanTitlesSeen.set(norm, s); // store song object
        }
      }
    });

    this.el.cntAll.textContent = all;
    this.el.cntKept.textContent = kept;
    this.el.cntCut.textContent = cut;
    this.el.cntUnreviewed.textContent = unreviewed;
    this.el.cntDupes.textContent = this.songs.filter(s => dupIds.has(s.id)).length;

    const reviewed = kept + cut;
    this.el.valReviewed.textContent = `${reviewed}/${all}`;
    this.el.valKept.textContent = kept;
    this.el.valCut.textContent = cut;
    const pct = all > 0 ? (reviewed / all) * 100 : 0;
    this.el.valProgressFill.style.width = `${pct}%`;

    this._renderTable();
  }

  /* ---- RENDER DATA TABLE ---- */
  _renderTable() {
    const list = this._getFilteredSongs();
    const tbody = this.el.tableBody;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No songs in this view.</td></tr>`;
      return;
    }

    let prevNorm = '';
    tbody.innerHTML = list.map(song => {
      const idx = this.songs.indexOf(song);
      const isCurrent = idx === this.currentIdx;
      const isKept = song.kept;
      const isCut = song.cut;

      const playIco = isCurrent && this.isPlaying
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

      const norm = song.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      let groupHeader = '';
      if (this.activeFilter === 'duplicates' && norm !== prevNorm) {
        groupHeader = `
          <tr class="dupe-group-header">
            <td colspan="7" style="background: #18181b; padding: 8px 16px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--color-gold); letter-spacing: 0.1em; border-bottom: 2px solid #27272a;">
              Duplicate Group: ${song.title}
            </td>
          </tr>
        `;
        prevNorm = norm;
      }

      const rowHtml = `
        <tr class="${isCurrent ? 'playing' : ''} ${isCut ? 'cut-row' : ''}">
          <td style="text-align: center;">
            <button class="btn-play-row" onclick="dashboardInstance._playSong(${idx})" title="Stream track">
              ${playIco}
            </button>
          </td>
          <td style="text-align: center;" class="item-index">${idx + 1}</td>
          <td>
            <div class="curate-cell">
              <button class="curate-btn keep ${isKept ? 'active' : ''}" onclick="dashboardInstance._curateKeep(${idx})">Keep</button>
              <button class="curate-btn cut ${isCut ? 'active' : ''}" onclick="dashboardInstance._curateCut(${idx})">Cut</button>
            </div>
          </td>
          <td>
            <input type="text" class="title-input" value="${escHtml(song.title)}" oninput="dashboardInstance._onTitleChange(${idx}, this.value)" onblur="dashboardInstance._onTitleBlur(${idx}, this.value)">
          </td>
          <td class="yt-id-cell">
            ${song.youtubeId ? `<a href="https://youtube.com/watch?v=${song.youtubeId}" target="_blank" style="color:inherit;text-decoration:none;">${song.youtubeId} ↗</a>` : 'Local File'}
          </td>
          <td class="duration-cell">${formatTime(song.duration)}</td>
          <td style="text-align: center;">
            <button class="btn-delete-row" onclick="dashboardInstance._deleteSongRow(${idx})" title="Remove track from DB">
              &times;
            </button>
          </td>
        </tr>
      `;

      return groupHeader + rowHtml;
    }).join('');
  }
}

// Instantiate Curation Dashboard Engine
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new CurationDashboard();
});
