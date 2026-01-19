
import os

content = r'''
  const handleCommissionerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginLeagueName || !loginPassword) return;

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueName: loginLeagueName, password: loginPassword })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Login failed');
      }

      // Store the admin token
      const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
      storedTokens[result.poolId] = loginPassword;
      localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));

      // Redirect to the pool
      setShowLoginModal(false);
      setLoginLeagueName('');
      setLoginPassword('');
      window.location.href = `${window.location.origin}/?poolId=${result.poolId}`;

    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStep1Next = async () => {
    if (!game.title || !wizardPassword) return;

    setWizardError(null);

    try {
      const res = await fetch(`${API_URL}/check-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueName: game.title })
      });

      const result = await res.json();

      if (!result.available) {
        setWizardError(`A league named "${game.title}" already exists. Please choose a different name.`);
        return;
      }

      // Name is available, proceed to step 2
      setWizardStep(2);

    } catch (err: any) {
      console.error('Name check failed:', err);
      // If check fails, still proceed (backend will catch duplicates)
      setWizardStep(2);
    }
  };

  const openSetupWizard = () => {
    setGame(INITIAL_GAME);
    setBoard(EMPTY_BOARD);
    setWizardPassword('');
    setWizardStep(1);
    setWizardSuccess(false);
    setWizardError(null);
    setShowWizardModal(true);
  };

  const isEmptyBoard = !board.squares.some(s => s.length > 0);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail || !recoveryEmail.includes('@')) return;
    setIsRecovering(true);
    try {
      const res = await fetch(`${API_URL}/recover-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Recovery email sent.");
        setShowRecoveryModal(false);
        setRecoveryEmail('');
      } else {
        alert("Recovery failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Network error during recovery.");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    try {
      // Determine target Pool ID
      let targetPoolId = activePoolId;
      const enteredId = authIdInput.trim().toUpperCase();

      if (enteredId && enteredId !== activePoolId) {
        // User wants to login to a different board
        // Identify valid format
        if (enteredId.length === 8) {
          targetPoolId = enteredId;
        } else {
          // Assume it's a name? For now, only ID is supported for direct switch
          // Or we could implement name lookup here.
          // Stick to ID for simplicity as per plan.
          targetPoolId = enteredId;
        }
      }

      // If we are switching boards, we just use the entered ID as the "Active" scope for this login attempt
      // But the handshake needs the URL update if successful.
      // Actually, simplest is: authenticate against the ID.
      if (!targetPoolId) throw new Error("Board ID is required");

      const res = await fetch(`${API_URL}/${targetPoolId}/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authInput}` }
      });

      if (res.ok) {
        const { token } = await res.json();
        const storedTokens = JSON.parse(localStorage.getItem('sbxpro_tokens') || '{}');
        storedTokens[targetPoolId] = token;
        localStorage.setItem('sbxpro_tokens', JSON.stringify(storedTokens));

        // If we switched boards, reload/redirect
        if (targetPoolId !== activePoolId) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('poolId', targetPoolId);
          window.location.href = newUrl.toString();
          return;
        }

        setAdminToken(token);
        setShowAdminView(true);
        setShowAuthModal(false);
        setAuthInput('');
      } else {
        alert("Invalid Passcode (or Board ID not found)");
      }
    } catch (err) {
      console.error(err);
      alert("Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#050505] overflow-hidden flex flex-col font-sans text-white">
      {/* ... (Keep Modal Wrappers) ... */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-gold-glass">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Commissioner Access</h3>
                <button type="button" onClick={() => !isAuthenticating && setShowAuthModal(false)} className="text-gray-400 hover:text-white">&times;</button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Board ID</label>
                <input type="text" value={authIdInput} onChange={(e) => setAuthIdInput(e.target.value.toUpperCase())} placeholder="e.g. 9TG82HJ2"
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-gold-glass outline-none transition-colors font-mono uppercase" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Password</label>
                <input autoFocus={!!authIdInput} type="password" value={authInput} onChange={(e) => setAuthInput(e.target.value)} placeholder="Enter Password" disabled={isAuthenticating}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-gold-glass outline-none transition-colors disabled:opacity-50" />
              </div>

              <button type="submit" disabled={isAuthenticating} className="w-full btn-cardinal py-2 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {isAuthenticating ? 'VERIFYING...' : 'Unlock Dashboard'}
              </button>

              <div className="text-center pt-2">
                <button type="button" onClick={() => { setShowAuthModal(false); setShowRecoveryModal(true); }} className="text-[10px] text-gray-500 hover:text-white underline">
                  Forgot Board ID?
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecoveryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Recover Board ID</h3>
                <button type="button" onClick={() => setShowRecoveryModal(false)} className="text-gray-400 hover:text-white">&times;</button>
              </div>

              <p className="text-[11px] text-gray-400 leading-tight">Enter the email you used during setup. We will send you a list of your Board IDs.</p>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold uppercase">Email Address</label>
                <input autoFocus type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="commissioner@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none transition-colors" />
              </div>

              <button type="submit" disabled={isRecovering} className="w-full btn-secondary py-2 rounded text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50">
                {isRecovering ? 'Sending...' : 'Send Recovery Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-white/20">
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Join Game</h3>
                <button type="button" onClick={() => setShowJoinModal(false)} className="text-gray-400 hover:text-white">&times;</button>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">Enter the Game Code shared by your Commissioner.</p>
              <input autoFocus type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Game Code (e.g. A7X9...)"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-white/40 outline-none transition-colors font-mono uppercase" />
              <button type="submit" disabled={isRefreshing} className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                {isRefreshing ? 'Verifying...' : (knownAdminToken ? 'Enter Commissioner Hub' : 'Enter Stadium')}
              </button>
            </form>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="liquid-glass p-6 w-full max-w-xs animate-in zoom-in duration-300 border-gold-glass">
            <form onSubmit={handleCommissionerLogin} className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Commissioner Login</h3>
                <button type="button" onClick={() => { setShowLoginModal(false); setLoginError(null); }} className="text-gray-400 hover:text-white">&times;</button>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">Enter your league name and password to access your dashboard.</p>
              {loginError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded p-2 text-[10px] text-red-400 font-bold">{loginError}</div>
              )}
              <input autoFocus type="text" value={loginLeagueName} onChange={(e) => setLoginLeagueName(e.target.value)} placeholder="League Name"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-gold-glass outline-none transition-colors" disabled={isLoggingIn} />
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Password"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-gold-glass outline-none transition-colors" disabled={isLoggingIn} />
              <button type="submit" disabled={isLoggingIn || !loginLeagueName || !loginPassword} className="w-full btn-cardinal py-3 rounded text-xs font-black uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                {isLoggingIn ? 'Authenticating...' : 'Access My League'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showWizardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="premium-glass w-full max-w-md overflow-hidden flex flex-col animate-in scale-95 duration-300">
            <div className="p-6 border-b border-white/5">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white tracking-tight">Board Setup</h2>
                {!wizardSuccess && <button onClick={() => setShowWizardModal(false)} className="text-gray-400 hover:text-white text-xs font-medium uppercase tracking-wide">Cancel</button>}
              </div>
              <div className="flex gap-2 mt-6">
                {[1, 2, 3].map(step => (
                  <div key={step} className={`h-1 flex-1 rounded-full transition-all duration-500 ${wizardStep >= step ? 'bg-white' : 'bg-white/10'}`}></div>
                ))}
              </div>
            </div>
            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
              {wizardSuccess ? (
                <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-500 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Ready to Launch</h3>
                  <p className="text-sm text-gray-400">Taking you to your board...</p>
                </div>
              ) : wizardError ? (
                <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-white">Setup Issue</h3>
                  <p className="text-sm text-gray-400 max-w-xs">{wizardError}</p>
                  <button onClick={() => setWizardError(null)} className="btn-secondary text-sm">Dismiss</button>
                </div>
              ) : (
                <>
                  {wizardStep === 1 && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-lg font-medium text-white mb-2">Name your board</h3>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-label">Board Name</label>
                          <input type="text" value={game.title} onChange={(e) => setGame(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full glass-input" placeholder="e.g. Super Bowl LIX" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-label">Email Address (for recovery)</label>
                          <input autoFocus type="email" value={wizardEmail} onChange={(e) => setWizardEmail(e.target.value)}
                            className="w-full glass-input" placeholder="commissioner@example.com" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-label">Organizer Passcode</label>
                          <input type="password" value={wizardPassword} onChange={(e) => setWizardPassword(e.target.value)}
                            className="w-full glass-input" placeholder="Create a secure passcode" />
                        </div>
                        <div className="pt-6">
                          <button disabled={!wizardPassword || !game.title || !wizardEmail.includes('@')} onClick={handleStep1Next}
                            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {wizardStep === 2 && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-lg font-medium text-white mb-2">Pick the game</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-label">Away Team</label>
                          <select value={game.leftAbbr} onChange={(e) => handleTeamChange('left', e.target.value)} className="w-full glass-input appearance-none bg-[#1c1c1e]">
                            {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-label">Home Team</label>
                          <select value={game.topAbbr} onChange={(e) => handleTeamChange('top', e.target.value)} className="w-full glass-input appearance-none bg-[#1c1c1e]">
                            {NFL_TEAMS.map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-label">Date (Optional)</label>
                        <input type="date" value={game.dates} onChange={(e) => setGame(prev => ({ ...prev, dates: e.target.value }))}
                          className="w-full glass-input" />
                      </div>
                      <div className="pt-6 flex gap-3">
                        <button onClick={() => setWizardStep(1)} className="btn-secondary">Back</button>
                        <button onClick={() => setWizardStep(3)} className="flex-1 btn-primary">Continue</button>
                      </div>
                    </div>
                  )}
                  {wizardStep === 3 && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                      <h3 className="text-lg font-medium text-white mb-2">Bring your board</h3>
                      <p className="text-sm text-gray-400">Upload a photo or screenshot. We’ll turn it into an editable grid.</p>

                      <div onClick={() => wizardFileRef.current?.click()} className="border border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer h-[180px] relative overflow-hidden group transition-all hover:bg-white/5 hover:border-white/30">
                        <input type="file" ref={wizardFileRef} className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Reset state for new attempt
                            setWizardError(null);
                            setIsCreating(true);
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                              try {
                                const rawBase64 = ev.target!.result as string;
                                const compressed = await compressImage(rawBase64);
                                setGame(p => ({ ...p, coverImage: compressed }));
                                const { parseBoardImage } = await loadGeminiService();
                                const scannedBoard = await parseBoardImage(compressed);
                                setBoard(scannedBoard);
                              } catch (err: any) {
                                console.warn("Scan failed", err);
                                setWizardError("Image processed, but grid scan failed: " + (err.message || "Invalid format"));
                              } finally {
                                setIsCreating(false);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }} />
                        {game.coverImage ? (
                          <>
                            <img src={game.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm" />
                            <div className="relative z-10 btn-secondary text-xs">Change Image</div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <span className="text-sm font-medium text-white">Tap to upload</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-center text-gray-500">Images only (PNG/JPG). PDF not supported.</p>

                      <div className="pt-4 space-y-3">
                        <button
                          onClick={() => {
                            if (!game.coverImage) {
                              setWizardError("Please upload an image to scan.");
                              return;
                            }
                            handleWizardInitialize();
                          }}
                          disabled={isCreating}
                          className={`w-full btn-primary flex items-center justify-center gap-2 ${!game.coverImage ? 'opacity-50' : ''}`}
                        >
                          {isCreating ? "Processing..." : "Launch Board"}
                        </button>

                        {!isCreating && (
                          <button onClick={(e) => { e.preventDefault(); handleWizardInitialize(EMPTY_BOARD, ''); }} className="w-full text-sm text-gray-400 hover:text-white transition-colors py-2">
                            Start with a blank board
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )
      }

      {
        showShareModal && (() => {
          const shareUrl = activePoolId ? `${window.location.origin}/?poolId=${activePoolId}` : window.location.href;
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="premium-glass w-full max-w-sm p-6 text-center flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                <h2 className="text-lg font-semibold text-white tracking-tight">Access Link</h2>
                <div className="bg-white p-4 rounded-xl shadow-lg"><QRCodeSVG value={shareUrl} size={160} /></div>
                <div className="bg-black/20 border border-white/5 rounded-lg p-3 flex items-center gap-3 w-full">
                  <div className="flex-1 text-xs font-mono text-gray-400 truncate text-left">{shareUrl}</div>
                  <button onClick={handleCopyLink} className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide bg-white/10 hover:bg-white/20 text-white transition-colors">{copyFeedback ? 'Copied' : 'Copy'}</button>
                </div>
                <button onClick={handleCloseShare} className="w-full btn-secondary text-sm">Close</button>
              </div>
            </div>
          );
        })()
      }

      {
        showLanding ? (
          <LandingPage onCreate={openSetupWizard} onJoin={() => setShowJoinModal(true)} onLogin={() => setShowLoginModal(true)} />
        ) : (
          <>
            <div className="flex-1 flex flex-col relative z-50 w-full max-w-6xl mx-auto md:px-6 h-full">
              {/* Header / Nav */}
              <div className="flex-shrink-0 flex items-center justify-between p-4 md:py-6 bg-transparent z-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9D2235] to-[#7f1d2b] flex items-center justify-center text-white font-bold tracking-tight shadow-lg border border-white/10">SBX</div>
                  <div className="flex flex-col">
                    <h1 className="text-xl font-bold leading-none tracking-tight text-white mb-1">{game.title || 'Super Bowl LIX'}</h1>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60 font-medium">
                        {game.leftAbbr} vs {game.topAbbr} • {game.dates || 'Feb 9, 2025'}
                      </span>
                      {isSynced && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Live Sync Active"></span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {activePoolId && (
                    <button onClick={() => setShowShareModal(true)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white border border-white/5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                  )}

                  {adminToken ? (
                    <div className="flex items-center gap-3">
                      {isPreviewMode && (
                        <span className="hidden md:inline text-[10px] uppercase font-bold text-gray-500 animate-in fade-in transition-colors">Preview Mode</span>
                      )}
                      <div className="flex items-center bg-white/10 p-1 rounded-full border border-white/5 backdrop-blur-md">
                        <button
                          onClick={() => handleTogglePreview(false)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${!isPreviewMode ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleTogglePreview(true)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${isPreviewMode ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  ) : activePoolId ? (
                    <button onClick={() => setShowAuthModal(true)} className="px-5 py-2.5 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-wide hover:bg-white/15 transition-colors border border-white/10">
                      Login
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 relative overflow-hidden flex flex-col md:flex-row gap-8 pb-6 px-4 md:px-0">
                {activeTab === 'live' && (
                  <div className="flex-1 h-full overflow-y-auto overflow-x-hidden pb-24 md:pb-0 scrollbar-hide animate-in fade-in duration-500">
                    <div className="space-y-6">
                      {liveStatus === 'NO MATCH FOUND' && (
                        <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-4">
                          <div className="p-2 rounded-full bg-yellow-500/20 text-yellow-500"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                          <div>
                            <h4 className="text-sm font-bold text-yellow-500 mb-1">Live Scoring Unavailable</h4>
                            <p className="text-xs text-yellow-500/80">Check your date and teams in the Organizer settings.</p>
                          </div>
                        </div>
                      )}

                      <InfoCards.Scoreboard game={game} live={liveData} onRefresh={fetchLive} isRefreshing={isRefreshing} liveStatus={liveStatus} />

                      <div className="grid md:grid-cols-2 gap-6">
                        <InfoCards.Payouts liveStatus={liveStatus} lastUpdated={lastUpdated} highlights={highlights} board={board} live={liveData} game={game} />

                        <div className="space-y-4">
                          <ScenarioPanel.LeftScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                          <ScenarioPanel.TopScenarios game={game} board={board} live={liveData} onScenarioHover={setHighlightedCoords} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`${activeTab === 'board' ? 'block' : 'hidden md:block'} md:flex-1 h-full overflow-hidden flex flex-col pb-24 md:pb-0`}>
                  <div className="flex-1 relative bg-[#1c1c1e]/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
                    <div className="absolute inset-0 overflow-auto touch-pan-x touch-pan-y p-4 flex items-center justify-center">
                      {isEmptyBoard ? (
                        <div className="text-center max-w-sm mx-auto p-8 animate-in fade-in zoom-in duration-500">
                          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                            <svg className="w-10 h-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2">Board is empty</h3>
                          <p className="text-sm text-gray-500 mb-8 leading-relaxed">Add names to squares to share with your group.</p>
                          {adminToken ? (
                            <button onClick={() => setShowAdminView(true)} className="btn-primary w-full shadow-lg">Edit Board</button>
                          ) : (
                            <div className="inline-flex px-4 py-2 rounded-full bg-white/5 border border-white/5 text-xs font-medium text-gray-500">Waiting for organizer...</div>
                          )}
                        </div>
                      ) : (
                        <BoardGrid
                          board={board}
                          highlights={highlights}
                          live={liveData}
                          selectedPlayer={selectedPlayer}
                          highlightedCoords={highlightedCoords}
                          leftTeamName={game.leftName || game.leftAbbr}
                          topTeamName={game.topName || game.topAbbr}
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <PlayerFilter board={board} setSelected={setSelectedPlayer} selected={selectedPlayer} />
                  </div>
                </div>
              </div>

              {/* Mobile Tab Bar */}
              <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex p-1.5 bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                <button onClick={() => setActiveTab('live')} className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'live' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  Live
                </button>
                <button onClick={() => setActiveTab('board')} className={`px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'board' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  Board
                </button>
                {adminToken && (
                  <button onClick={() => setShowAdminView(true)} className="ml-2 w-10 h-10 rounded-full bg-[#9D2235] text-white flex items-center justify-center shadow-lg border border-red-500/20">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                )}
              </div>
            </div>
          </>
        )
      }

      {/* Commissioner Overlay */}
      {
        isCommissionerMode && (
          <div className="fixed inset-0 z-[80] bg-[#050101] p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50">Loading Organizer...</div>}>
              <AdminPanel
                game={game}
                board={board}
                adminToken={adminToken}
                activePoolId={activePoolId}
                onApply={(g, b) => { setGame(g); setBoard(b); }}
                onPublish={handlePublish}
                onClose={() => handleTogglePreview(true)}
                onLogout={handleLogout}
                onPreview={() => handleTogglePreview(true)}
              />
            </Suspense>
          </div>
        )
      }
    </div >
  );
};

// Use BoardView name directly
const BoardView: React.FC = () => {
  return (
    <ErrorBoundary>
      <BoardViewContent />
    </ErrorBoundary>
  );
};

export default BoardView;
'''

import re

# Refactoring steps:
# The import paths replacement was done in restore_part1.py implicitly? No, I copied the raw text. AHH.
# I need to do the replacements on the FINAL concatenated file.
# So I will append this content to the existing file first.

with open("components/BoardView.tsx", "a") as f:
    f.write(content)

# Now read the WHOLE file and replace imports
with open("components/BoardView.tsx", "r") as f:
    final_content = f.read()

# Apply Replacements
final_content = final_content.replace("from './types'", "from '../types'")
final_content = final_content.replace("from './constants'", "from '../constants'")
final_content = final_content.replace("import('./components/", "import('./")
final_content = final_content.replace("from './components/", "from './")
final_content = final_content.replace("from './services/", "from '../services/")
final_content = final_content.replace("import('./services/", "import('../services/")
final_content = final_content.replace("from './hooks/", "from '../hooks/")
final_content = final_content.replace("import ErrorBoundary from './components/ErrorBoundary';", "import ErrorBoundary from './ErrorBoundary';")

# Just to be safe with AppContent -> BoardViewContent renaming if missed
final_content = final_content.replace("const AppContent: React.FC", "const BoardViewContent: React.FC")
final_content = final_content.replace("const App: React.FC", "const BoardView: React.FC")

with open("components/BoardView.tsx", "w") as f:
    f.write(final_content)
