import React, { useState, useEffect } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import { Trash2, AlertTriangle, User, Save, Globe, RefreshCw, Sliders, Code2, TerminalSquare, Info, Lock, Check, Sparkles, SlidersHorizontal, ShieldAlert, Cpu, HardDrive, MemoryStick as MemoryStickIcon } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import SearchableDropdown from "./SearchableDropdown";
import CategorizedVersionDropdown from "./CategorizedVersionDropdown";
import { getJavaVersionForMinecraft } from "../utils/minecraftJava";
import { parseRam, formatRam } from "../utils/ram";

export default function ServerSettings({ serverId, server }: { serverId: string, server: any }) {
  const { isDevPanel } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [owner, setOwner] = useState(server?.owner || "");
  const [ipAlias, setIpAlias] = useState(server?.ipAlias || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(server?.version || "");
  const [selectedType, setSelectedType] = useState((server?.type || "PAPER").toUpperCase());
  const [isChangingVersion, setIsChangingVersion] = useState(false);
  const [versionProgress, setVersionProgress] = useState(0);
  const [javaVersion, setJavaVersion] = useState(server?.javaVersion || "");
  const [dockerImage, setDockerImage] = useState(server?.dockerImage || "");
  const [serverJar, setServerJar] = useState(server?.serverJar || "");
  const [startupCommand, setStartupCommand] = useState(server?.startupCommand || "");
  const [showDowngradeRestartPopup, setShowDowngradeRestartPopup] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isMigratingRuntime, setIsMigratingRuntime] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [ramInput, setRamInput] = useState<string>(server?.ram !== undefined ? String(server.ram) : "1 GB");
  const [cpuInput, setCpuInput] = useState<number | string>(server?.cpu || 100);
  const [diskInput, setDiskInput] = useState<number | string>(server?.disk || 10);
  const [isSavingResources, setIsSavingResources] = useState<boolean>(false);
  const [resourceMessage, setResourceMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSaveResources = async () => {
    setIsSavingResources(true);
    setResourceMessage(null);
    try {
      const token = localStorage.getItem("n1x_token") || localStorage.getItem("jtg_token") || localStorage.getItem("token");
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await axios.put(`/api/servers/${serverId}/resources`, {
        ram: ramInput,
        cpu: cpuInput,
        disk: diskInput
      }, { headers });
      setResourceMessage({ text: "Server resources saved successfully! Restart the server to apply updated limits.", type: "success" });
      if (server) {
        server.ram = ramInput;
        server.cpu = Number(cpuInput);
        server.disk = Number(diskInput);
      }
    } catch (err: any) {
      setResourceMessage({ text: err.response?.data?.error || err.message || "Failed to update resources.", type: "error" });
    } finally {
      setIsSavingResources(false);
    }
  };
  
  useEffect(() => {
    // Fetch software versions
    axios.get(`/api/system/versions?type=${selectedType}`).then((res) => {
      if (Array.isArray(res.data)) {
        setVersions(res.data);
        if (!res.data.includes(selectedVersion)) {
          setSelectedVersion(res.data[0]);
        }
      } else {
        setVersions([]);
      }
    }).catch(() => {});

    if ((user?.role === "admin" || user?.role === "owner")) {
      axios.get("/api/auth/users").then(res => {
        setUsers(res.data);
      }).catch(() => {});
    }
  }, [user, selectedType]);

  // Synchronize recommended Java version whenever selected Minecraft version changes
  useEffect(() => {
    if (selectedVersion) {
      const autoJava = getJavaVersionForMinecraft(selectedVersion, selectedType);
      // Auto-update if unset or if switching away from Java 25 (Paper 26.x default)
      if (!javaVersion || (javaVersion === "25" && !selectedVersion.startsWith("26"))) {
        setJavaVersion(autoJava);
      }
    }
  }, [selectedVersion, selectedType]);

  if (!server) return null;
  const canManage = (user?.role === "admin" || user?.role === "owner") || server.owner === user?.id;

  const handleDelete = async () => {
    try {
      setIsDeletingAction(true);
      await axios.delete(`/api/servers/${serverId}`);
      navigate("/servers");
    } catch(e) {
      alert("Failed to delete server");
      setIsDeletingAction(false);
      setShowDeleteConfirm(false);
    }
  };


  const handleChangeVersion = async () => {
    setIsChangingVersion(true);
    setVersionProgress(10);
    // Fake progress interval since server handles the real download synchronously for now
    // In a real app we'd use SSE or websockets to report download progress
    const interval = setInterval(() => {
        setVersionProgress(p => p < 90 ? p + 10 : p);
    }, 500);

    try {
      await axios.put(`/api/servers/${serverId}/version`, {
        version: selectedVersion,
        type: selectedType,
        javaVersion: javaVersion,
        dockerImage: dockerImage,
        serverJar: serverJar,
        startupCommand: startupCommand
      });
      setVersionProgress(100);
      setTimeout(() => {
         window.location.reload();
      }, 1000);
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to update version");
      setIsChangingVersion(false);
    } finally {
      clearInterval(interval);
    }
  };

  const handleDowngradeRestart = async () => {
    try {
      setIsRestarting(true);
      await axios.post(`/api/servers/${serverId}/restart`);
      setShowDowngradeRestartPopup(false);
    } catch (e: any) {
      alert("Failed to restart server: " + (e.response?.data?.error || e.message));
    } finally {
      setIsRestarting(false);
    }
  };

  const handleUpdateOwner = async () => {
    try {
      setIsSaving(true);
      await axios.put(`/api/servers/${serverId}/owner`, { owner });
      alert("Owner updated successfully");
    } catch(e) {
      alert("Failed to update owner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateIpAlias = async () => {
    try {
      setIsSavingAlias(true);
      await axios.put(`/api/servers/${serverId}/ipalias`, { ipAlias });
      alert("IP Alias updated successfully");
    } catch(e) {
      alert("Failed to update IP Alias");
    } finally {
      setIsSavingAlias(false);
    }
  };

  return (
    <>
      {showDowngradeRestartPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-black/60 backdrop-blur-2xl border border-border p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-border-subtle relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-theme-600/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-600 to-theme-500"></div>
            <div className="flex items-start mb-4">
              <div className="bg-theme-600/20 p-3 rounded-xl mr-4 text-theme-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Restart Required</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Restart the server to ensure files are processed correctly.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={handleDowngradeRestart}
                disabled={isRestarting}
                className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-black font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {isRestarting ? "Restarting..." : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar text-foreground bg-transparent">
      <div className="max-w-3xl space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-2">Settings</h2>
          <p className="text-muted-foreground text-sm mb-6">Manage advanced configuration and dangerous actions for this unit.</p>
        </div>

        {canManage ? (
          <>

            {/* Resource Allocation Card */}
            <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-foreground font-bold flex items-center text-lg">
                  <SlidersHorizontal className="w-5 h-5 mr-2 text-theme-500" /> Resource Allocation (RAM & CPU)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  Live Config
                </span>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Customize RAM (e.g. <code className="text-theme-400 font-mono">256 MB</code>, <code className="text-theme-400 font-mono">512 MB</code>, <code className="text-theme-400 font-mono">1 GB</code>, <code className="text-theme-400 font-mono">4 GB</code>), CPU Limit (%), and Disk space for this unit.
              </p>

              {resourceMessage && (
                <div className={`mb-6 p-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${resourceMessage.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
                  <Check className="w-4 h-4" /> {resourceMessage.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* RAM Input */}
                <div>
                  <label className="flex items-center justify-between text-sm text-[#8f8f8f] mb-2 font-medium">
                    <span className="flex items-center gap-1.5"><MemoryStickIcon className="w-4 h-4 text-theme-400" /> RAM Memory</span>
                    <span className="text-[11px] text-theme-400 font-mono">{formatRam(ramInput)}</span>
                  </label>
                  <input
                    type="text"
                    value={ramInput}
                    onChange={(e) => setRamInput(e.target.value)}
                    placeholder="e.g. 256 MB, 512 MB, 2 GB"
                    className="w-full bg-[#0e0e0e] border border-[#232323] focus:border-white rounded-xl p-3 text-white font-mono text-sm outline-none transition-all"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {["256 MB", "512 MB", "1 GB", "2 GB", "4 GB", "8 GB"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRamInput(preset)}
                        className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-all ${ramInput === preset ? "bg-white text-black border-white font-bold" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600"}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CPU Limit */}
                <div>
                  <label className="flex items-center justify-between text-sm text-[#8f8f8f] mb-2 font-medium">
                    <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-theme-400" /> CPU Limit (%)</span>
                    <span className="text-[11px] text-theme-400 font-mono">{cpuInput}%</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="10"
                      value={cpuInput}
                      onChange={(e) => setCpuInput(e.target.value)}
                      placeholder="100"
                      className="w-full bg-[#0e0e0e] border border-[#232323] focus:border-white rounded-xl p-3 pr-8 text-white font-mono text-sm outline-none transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">%</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[25, 50, 100, 150, 200, 400].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCpuInput(preset)}
                        className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-all ${Number(cpuInput) === preset ? "bg-white text-black border-white font-bold" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600"}`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Disk Limit */}
                <div>
                  <label className="flex items-center justify-between text-sm text-[#8f8f8f] mb-2 font-medium">
                    <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-theme-400" /> Disk Space</span>
                    <span className="text-[11px] text-theme-400 font-mono">{diskInput} GB</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={diskInput}
                      onChange={(e) => setDiskInput(e.target.value)}
                      placeholder="10"
                      className="w-full bg-[#0e0e0e] border border-[#232323] focus:border-white rounded-xl p-3 pr-10 text-white font-mono text-sm outline-none transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">GB</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[5, 10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDiskInput(preset)}
                        className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-all ${Number(diskInput) === preset ? "bg-white text-black border-white font-bold" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600"}`}
                      >
                        {preset}G
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={handleSaveResources}
                  disabled={isSavingResources}
                  className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-theme-600/20 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {isSavingResources ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSavingResources ? "Saving Resources..." : "Save Resources"}
                </button>
              </div>
            </div>

            
            
            
            {/* RUNTIME CONFIGURATION */}
            {(() => {
              const upperType = (server?.type || "").toUpperCase();
              const isGeneric = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(upperType);
              const isNode = ["NODEJS", "NODE"].includes(upperType);
              const isPy = ["PYTHON", "PYTHON3"].includes(upperType);

              if (isGeneric) {
                return (
                  <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-theme-500 font-bold flex items-center gap-2">
                        {isNode ? <Code2 className="w-5 h-5 text-theme-500" /> : <TerminalSquare className="w-5 h-5 text-theme-500" />}
                        {isNode ? "Node.js Runtime Environment" : "Python Runtime Environment"}
                      </h3>
                      <span className="flex items-center gap-1.5 text-xs font-mono bg-white/10 text-white/90 px-2.5 py-1 rounded-full border border-white/10">
                        <Lock className="w-3 h-3 text-theme-400" /> Fixed Runtime
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      Dedicated standalone code runtime. Upload your project scripts, packages, and dependencies in the File Manager and start them in the Console.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Runtime Platform</label>
                        <div className="w-full bg-card/60 border border-border rounded-xl px-4 py-3 text-foreground font-mono text-sm flex items-center justify-between opacity-80 cursor-not-allowed">
                          <span>{isNode ? "Node.js (JavaScript / TypeScript)" : "Python (Python 3.x)"}</span>
                          <span className="text-xs text-muted-foreground">Fixed</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Runtime Version</label>
                        <SearchableDropdown
                          value={selectedVersion}
                          onChange={setSelectedVersion}
                          options={versions.map(v => ({ value: v, label: isNode ? `Node.js v${v}` : `Python ${v}` }))}
                          placeholder="Select Version"
                          searchPlaceholder="Search versions..."
                          disabled={isChangingVersion}
                          className="font-mono bg-card"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Startup Command</label>
                        <input
                          type="text"
                          value={startupCommand}
                          onChange={e => setStartupCommand(e.target.value)}
                          placeholder={isNode ? "e.g. node index.js or npm start" : "e.g. python3 -u main.py"}
                          disabled={isChangingVersion}
                          className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground font-mono mt-1.5">
                          {isNode ? "Leave empty to automatically execute index.js, app.js, or package.json start script." : "Leave empty to automatically execute main.py, app.py, or bot.py."}
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-2">Custom Docker Image (Optional)</label>
                        <input
                          type="text"
                          value={dockerImage}
                          onChange={e => setDockerImage(e.target.value)}
                          placeholder={isNode ? "node:20-alpine" : "python:3.11-slim"}
                          disabled={isChangingVersion}
                          className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={handleChangeVersion}
                        disabled={isChangingVersion}
                        className="px-6 py-3 bg-theme-600/10 hover:bg-theme-600/20 text-theme-600 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center min-w-[160px] justify-center h-[50px]"
                      >
                        {isChangingVersion ? "Updating..." : "Update Runtime"}
                      </button>
                    </div>

                    {isChangingVersion && (
                      <div className="mt-6 p-4 border border-zinc-800 bg-muted rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-theme-500">Updating runtime configuration...</span>
                          <span className="text-sm font-mono text-theme-500/80">{versionProgress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800/50 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-theme-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${versionProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              const autoDetectedJava = getJavaVersionForMinecraft(selectedVersion, selectedType);

              return (
                <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
                  <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                    <Sliders className="w-5 h-5 mr-2" /> Minecraft Runtime
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Configure server software, Java version, and Docker image.
                    <span className="text-theme-500/80 block mt-1">
                      WARNING: The server MUST be stopped before changing the runtime. A backup will be created automatically.
                    </span>
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Software Type</label>
                      <select
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none"
                      >
                        <option value="PAPER">Paper</option>
                        <option value="SPIGOT">Spigot</option>
                        <option value="FABRIC">Fabric</option>
                        <option value="FORGE">Forge</option>
                        <option value="BUNGEECORD">BungeeCord</option>
                        <option value="VELOCITY">Velocity</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Software Version</label>
                      <CategorizedVersionDropdown
                        value={selectedVersion}
                        onChange={setSelectedVersion}
                        versions={versions}
                        software={selectedType}
                        disabled={isChangingVersion}
                        placeholder="Select Version"
                        className="font-mono bg-card"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-muted-foreground">Java Version</label>
                        {javaVersion ? (
                          <button
                            type="button"
                            onClick={() => setJavaVersion("")}
                            className="text-xs text-theme-400 hover:text-theme-300 underline cursor-pointer"
                          >
                            Reset to Auto-detect
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <Sparkles className="w-3 h-3" /> Auto: Java {autoDetectedJava}
                          </span>
                        )}
                      </div>
                      <select
                        value={javaVersion}
                        onChange={e => setJavaVersion(e.target.value)}
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      >
                        <option value="">Auto-detect (Java {autoDetectedJava} Recommended)</option>
                        <option value="26">Java 26 (Latest JDK)</option>
                        <option value="25">Java 25 (Required for Paper 26.x)</option>
                        <option value="21">Java 21 (LTS • Recommended for 1.20.5 - 1.21.x)</option>
                        <option value="17">Java 17 (LTS • Recommended for 1.18 - 1.20.4)</option>
                        <option value="16">Java 16 (Recommended for 1.17)</option>
                        <option value="11">Java 11 (Recommended for 1.13 - 1.16)</option>
                        <option value="8">Java 8 (Legacy • Required for 1.12.2 & below)</option>
                      </select>
                      <div className="mt-2">
                        {!javaVersion ? (
                          <p className="text-xs text-emerald-400/90 font-mono flex items-center gap-1.5 bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
                            <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                            <span>Auto-detection active: <strong>Java {autoDetectedJava}</strong> will be used for {selectedVersion || 'this version'}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-amber-400/90 font-mono flex items-center gap-1.5 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10">
                            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span>Manual override: <strong>Java {javaVersion}</strong> selected {javaVersion !== autoDetectedJava && `(Auto recommends Java ${autoDetectedJava})`}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Docker Image</label>
                      <input
                        type="text"
                        value={dockerImage}
                        onChange={e => setDockerImage(e.target.value)}
                        placeholder="e.g. ghcr.io/pterodactyl/yolks:java_17"
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Server JAR</label>
                      <input
                        type="text"
                        value={serverJar}
                        onChange={e => setServerJar(e.target.value)}
                        placeholder="e.g. server.jar"
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">Startup Command</label>
                      <input
                        type="text"
                        value={startupCommand}
                        onChange={e => setStartupCommand(e.target.value)}
                        placeholder="e.g. java -Xms1G -Xmx4G -jar server.jar --nogui"
                        disabled={isChangingVersion}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-3 text-foreground transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>
                  
                  {server?.version?.startsWith("26") && selectedVersion && !selectedVersion.startsWith("26") && (
                    <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-300/90 leading-relaxed">
                        <strong className="text-amber-200">Safe Downgrade Protection Active:</strong> Changing from {server.version} to {selectedVersion} will automatically create a full backup in your Backups tab and switch the runtime environment to <strong>Java {autoDetectedJava}</strong>. Incompatible world data is safely archived so your server starts cleanly without missing-dimensions crashes.
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end mt-4">
                    <button 
                      onClick={handleChangeVersion}
                      disabled={isChangingVersion}
                      className="px-6 py-3 bg-theme-600/10 hover:bg-theme-600/20 text-theme-600 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center min-w-[160px] justify-center h-[50px]"
                    >
                      {isChangingVersion ? "Updating..." : "Update Runtime"}
                    </button>
                  </div>
                  {isChangingVersion && (
                    <div className="mt-6 p-4 border border-zinc-800 bg-muted rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-theme-500">Updating runtime configuration...</span>
                        <span className="text-sm font-mono text-theme-500/80">{versionProgress}%</span>
                      </div>
                      <div className="w-full bg-zinc-800/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-theme-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${versionProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
<div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-20 group hover:bg-black/60 transition-colors mb-8">
              <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                <Globe className="w-5 h-5 mr-2" /> Server IP Alias
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Set a custom domain or IP to display on the console page.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={ipAlias} 
                    onChange={e => setIpAlias(e.target.value)} 
                    placeholder="e.g. play.example.com"
                    className="w-full bg-card border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2 text-foreground transition-all shadow-inner outline-none font-mono"
                  />
                </div>
                <button 
                  onClick={handleUpdateIpAlias}
                  disabled={isSavingAlias || ipAlias === (server.ipAlias || "")}
                  className="px-6 py-2 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" /> Save
                </button>
              </div>
            </div>

            {(user?.role === "admin" || user?.role === "owner") ? (
              <>

                <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-10 group hover:bg-black/60 transition-colors">
                  <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                    <User className="w-5 h-5 mr-2" /> Server Ownership
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Transfer the ownership of this server to another user.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <SearchableDropdown
                        value={owner}
                        onChange={setOwner}
                        options={users.map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                        placeholder="Select an owner..."
                        searchPlaceholder="Search users..."
                        className="bg-card"
                      />
                    </div>
                    <button 
                      onClick={handleUpdateOwner}
                      disabled={isSaving || owner === server.owner}
                      className="px-6 py-2 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center"
                    >
                      <Save className="w-4 h-4 mr-2" /> Save
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {canManage && (
              <div className="bg-rose-950/20 dark:bg-rose-950/20 backdrop-blur-xl border border-rose-500/30 p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/20 mt-8 mb-8">
                <h3 className="text-rose-400 font-bold mb-2 flex items-center text-lg">
                  <Trash2 className="w-5 h-5 mr-2" /> Danger Zone: Delete Server
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Permanently delete this server instance, including all of its files, configurations, and backups. This action cannot be undone.
                </p>
                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-semibold rounded-xl border border-rose-500/40 transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Server
                  </button>
                ) : (
                  <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-bold text-rose-200 text-sm">Are you absolutely sure?</div>
                        <div className="text-xs text-rose-300/80">This will stop the process and permanently erase all data for {server.name}.</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeletingAction}
                        className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isDeletingAction}
                        className="flex-1 sm:flex-none px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2"
                      >
                        {isDeletingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {isDeletingAction ? "Deleting..." : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
           <div className="text-muted-foreground text-sm p-4 bg-muted rounded-xl border border-border-subtle">
             You do not have permission to manage this server's settings.
           </div>
        )}
      </div>
          {(isDeletingAction || isSaving || isSavingAlias || isChangingVersion || isRestarting) && <LoadingOverlay />}
    </div>
    </>
  );
}
