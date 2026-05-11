import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, LogOut, User, Users, Shield, Trash2, ExternalLink, Loader2, MapPin, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth, logout, type Profile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocations, useSaveLocations } from "@/lib/hooks/useLocations";
import { useStones } from "@/lib/hooks/useStones";
import { toast } from "sonner";

const SUPABASE_USERS_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '')}.supabase.co`;
const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const usersDashboardUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/auth/users` : SUPABASE_USERS_URL;

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .order('email');
  if (error) throw error;
  return data as Profile[];
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, isOwner } = useAuth();
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    enabled: isOwner,
  });

  const { data: locations = [], isLoading: locsLoading } = useLocations();
  const { data: stones = [] } = useStones();
  const saveLocations = useSaveLocations();
  const [addingLoc, setAddingLoc] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [editingLocIdx, setEditingLocIdx] = useState<number | null>(null);
  const [editLocName, setEditLocName] = useState("");

  function handleAddLocation() {
    const name = newLocName.trim();
    if (!name) { toast.error("Name required"); return; }
    if (locations.includes(name)) { toast.error("Already exists"); return; }
    saveLocations.mutate([...locations, name], {
      onSuccess: () => { setAddingLoc(false); setNewLocName(""); toast.success(`Added "${name}"`); },
      onError: (e) => toast.error(`Add failed: ${(e as Error).message}`),
    });
  }

  function handleRenameLocation(idx: number) {
    const name = editLocName.trim();
    if (!name) { toast.error("Name required"); return; }
    if (name === locations[idx]) { setEditingLocIdx(null); return; }
    if (locations.includes(name)) { toast.error("Already exists"); return; }
    const next = [...locations];
    next[idx] = name;
    saveLocations.mutate(next, {
      onSuccess: () => { setEditingLocIdx(null); toast.success("Renamed"); },
      onError: (e) => toast.error(`Rename failed: ${(e as Error).message}`),
    });
  }

  function handleDeleteLocation(name: string) {
    const itemsHere = stones.filter(s => s.status === "active" && s.location === name).length;
    const msg = itemsHere > 0
      ? `"${name}" has ${itemsHere} item${itemsHere === 1 ? "" : "s"}. Delete anyway? Items will lose their location.`
      : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    saveLocations.mutate(locations.filter(l => l !== name), {
      onSuccess: () => toast.success("Location deleted"),
      onError: (e) => toast.error(`Delete failed: ${(e as Error).message}`),
    });
  }

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'owner' | 'staff' }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      // Removes the profile. Auth user remains; remove via Supabase Dashboard if you want full deletion.
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-3xl mx-auto space-y-6">
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Settings</h1>

        {/* Profile */}
        <section className="glass-card rounded-xl p-5">
          <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-accent" />Your Account
          </h2>
          {profile ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{profile.email}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{profile.full_name || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium text-foreground capitalize">{profile.role}</span>
              </div>
              <Button onClick={handleLogout} variant="outline" className="rounded-xl mt-2">
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </section>

        {/* Locations */}
        <section className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />Locations
            </h2>
            {!addingLoc && (
              <Button onClick={() => setAddingLoc(true)} size="sm" variant="outline" className="rounded-lg h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />Add
              </Button>
            )}
          </div>

          {addingLoc && (
            <div className="flex items-center gap-2 mb-3">
              <Input
                autoFocus
                value={newLocName}
                onChange={e => setNewLocName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddLocation(); if (e.key === "Escape") { setAddingLoc(false); setNewLocName(""); } }}
                placeholder="New location name"
                className="rounded-lg h-9"
              />
              <Button size="sm" onClick={handleAddLocation} disabled={saveLocations.isPending} className="bg-accent text-accent-foreground rounded-lg">
                {saveLocations.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingLoc(false); setNewLocName(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {locsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {locations.map((loc, idx) => {
                const isEditingThis = editingLocIdx === idx;
                return (
                  <div key={loc} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40">
                    {isEditingThis ? (
                      <>
                        <Input
                          autoFocus
                          value={editLocName}
                          onChange={e => setEditLocName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleRenameLocation(idx); if (e.key === "Escape") setEditingLocIdx(null); }}
                          className="rounded-lg h-8 text-sm flex-1"
                        />
                        <button onClick={() => handleRenameLocation(idx)} className="p-1.5 rounded-lg hover:bg-secondary text-success">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingLocIdx(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{loc}</span>
                        <button
                          onClick={() => { setEditingLocIdx(idx); setEditLocName(loc); }}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {locations.length === 0 && !addingLoc && (
                <p className="text-sm text-muted-foreground text-center py-3">No locations yet.</p>
              )}
            </div>
          )}
        </section>

        {/* User Management — owner only */}
        {isOwner && (
          <section className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />Team Members
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Owners can manage roles. To add a new staff member, create them in the Supabase Dashboard, then they'll appear here.
            </p>

            <a
              href={usersDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline mb-4"
            >
              Open Supabase Auth Dashboard <ExternalLink className="h-3.5 w-3.5" />
            </a>

            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {profiles.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{p.email}</p>
                      <p className="text-xs text-muted-foreground">{p.full_name || 'No name set'}</p>
                    </div>
                    <select
                      value={p.role}
                      onChange={e => setRole.mutate({ id: p.id, role: e.target.value as 'owner' | 'staff' })}
                      disabled={p.id === profile?.id || setRole.isPending}
                      className="text-xs rounded-lg border border-border bg-background px-2 py-1 font-medium"
                      title={p.id === profile?.id ? "You can't change your own role" : ""}
                    >
                      <option value="staff">Staff</option>
                      <option value="owner">Owner</option>
                    </select>
                    {p.id !== profile?.id && (
                      <button
                        onClick={() => {
                          if (!confirm(`Remove ${p.email} from the app? Their auth account remains until you delete it from the Supabase Dashboard.`)) return;
                          removeUser.mutate(p.id, {
                            onSuccess: () => toast.success("User removed"),
                            onError: (e) => toast.error(`Remove failed: ${(e as Error).message}`),
                          });
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Remove user from app"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {profiles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No team members yet.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Footer info */}
        <section className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Data is stored in Supabase. Daily backups are managed by Supabase.
          </div>
        </section>

        {!isOwner && profile && (
          <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <SettingsIcon className="h-3 w-3" /> Contact an owner to manage team members.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
