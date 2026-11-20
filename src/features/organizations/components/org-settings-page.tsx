"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Users, Building2, DollarSign, Trash2, Save, Loader2, ArrowRight, Shield, BarChart3, CreditCard, Key, Settings, Clock, Mail, X, Zap, Globe, Lock, Activity, Wrench, Bell, Eye, Download, Upload, KeyRound, ShieldCheck, Users2, FileText, Link2, Terminal, AlertTriangle, CheckCircle2, ExternalLink, Calendar, MessageSquare, Filter } from "lucide-react";
import { toast } from "sonner";

import { listOrgMembersAction, inviteOrgMemberAction, removeOrgMemberAction, transferOwnershipAction, updateOrgMemberRoleAction, getOrgProfitabilityAction, updateOrgAction, getOrgSubscriptionAction, listOrgInvitationsAction, cancelOrgInvitationAction, resendOrgInvitationAction, updateOrgSettingsAction, listOrgApiKeysAction, createOrgApiKeyAction, deleteOrgApiKeyAction, listOrgWebhooksAction, createOrgWebhookAction, updateOrgWebhookAction, deleteOrgWebhookAction, listOrgActivityAction, revokeAllOrgSessionsAction, deleteOrgAction } from "../actions";

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
  user_email: string;
  user_name: string;
}

interface Profitability {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  overallMargin: number;
  projects: Array<{
    project_id: string;
    project_name: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  }>;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  invited_by_name: string;
  invited_by_email: string;
  created_at: string;
}

interface OrgSubscription {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  actor_name: string;
  actor_email: string;
  target_type: string;
  target_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface OrgSettingsPageProps {
  initialData: {
    org: {
      id: string;
      name: string;
      slug: string;
      owner_user_id: string;
      brand_color: string | null;
      brand_tagline: string | null;
      logo_url: string | null;
      settings: Record<string, unknown>;
    };
    member_count: number;
    user_role: string;
    is_owner: boolean;
  };
  orgId: string;
  initialSubscription: OrgSubscription | null;
}

export function OrgSettingsPage({ initialData, orgId, initialSubscription }: OrgSettingsPageProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [transferConfirm, setTransferConfirm] = useState<string | null>(null);
  const [profitability, setProfitability] = React.useState<Profitability | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = React.useState({
    name: "",
    brand_color: "",
    brand_tagline: "",
    logo_url: "",
  });
  const [subscription, setSubscription] = React.useState<OrgSubscription | null>(initialSubscription);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [settings, setSettings] = React.useState<Record<string, unknown>>(initialData.org.settings || {});
  const [savingSettings, setSavingSettings] = useState(false);
  const [apiKeys, setApiKeys] = React.useState<Array<{
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
    scopes: string[];
  }>>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [webhooks, setWebhooks] = React.useState<Array<{
    id: string;
    url: string;
    events: string[];
    status: string;
    created_at: string;
  }>>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [createApiKeyDialogOpen, setCreateApiKeyDialogOpen] = useState(false);
  const [createApiKeyName, setCreateApiKeyName] = useState("");
  const [createApiKeyScopes, setCreateApiKeyScopes] = useState<string[]>(["read", "write"]);
  const [createWebhookDialogOpen, setCreateWebhookDialogOpen] = useState(false);
  const [createWebhookUrl, setCreateWebhookUrl] = useState("");
  const [createWebhookEvents, setCreateWebhookEvents] = useState<string[]>(["invoice.created", "invoice.paid", "contract.signed"]);
  const [activity, setActivity] = React.useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityFilters, setActivityFilters] = useState({ actor: "", action: "", dateFrom: "", dateTo: "" });
  const [revokeAllSessionsOpen, setRevokeAllSessionsOpen] = useState(false);

  const { org, member_count, user_role, is_owner } = initialData;
  const isAdmin = user_role === "owner" || user_role === "admin";

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    const result = await listOrgMembersAction(orgId);
    if (result.ok) setMembers(result.data.members);
    setLoadingMembers(false);
  }, [orgId]);

  const loadProfitability = useCallback(async () => {
    setProfitabilityLoading(true);
    const result = await getOrgProfitabilityAction(orgId);
    if (result.ok && result.data) setProfitability(result.data);
    setProfitabilityLoading(false);
  }, [orgId]);

  const loadSubscription = useCallback(async () => {
    const result = await getOrgSubscriptionAction(orgId);
    if (result.ok && result.subscription) setSubscription(result.subscription);
  }, [orgId]);

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    const result = await listOrgInvitationsAction(orgId);
    if (result.ok && result.invitations) setInvitations(result.invitations);
    setLoadingInvitations(false);
  }, [orgId]);

  const loadApiKeys = useCallback(async () => {
    setLoadingApiKeys(true);
    const result = await listOrgApiKeysAction(orgId);
    if (result.ok && result.data) setApiKeys(result.data.apiKeys);
    setLoadingApiKeys(false);
  }, [orgId]);

  const loadWebhooks = useCallback(async () => {
    setLoadingWebhooks(true);
    const result = await listOrgWebhooksAction(orgId);
    if (result.ok && result.data) setWebhooks(result.data.webhooks);
    setLoadingWebhooks(false);
  }, [orgId]);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    const result = await listOrgActivityAction(orgId, { page: activityPage, limit: 20, ...activityFilters });
    if (result.ok && result.data) {
      setActivity(result.data.items);
      // Note: total count available in result.data.total for pagination
    }
    setLoadingActivity(false);
  }, [orgId, activityPage, activityFilters]);

  useEffect(() => {
    setBranding({
      name: initialData.org.name,
      brand_color: initialData.org.brand_color || "",
      brand_tagline: initialData.org.brand_tagline || "",
      logo_url: initialData.org.logo_url || "",
    });
    setSettings(initialData.org.settings || {});
    loadMembers();
    loadProfitability();
    loadSubscription();
    loadInvitations();
    loadApiKeys();
    loadWebhooks();
    loadActivity();
  }, [orgId, loadMembers, loadProfitability, loadSubscription, loadInvitations, loadApiKeys, loadWebhooks, loadActivity, initialData]);

  async function handleInvite() {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("email", inviteEmail);
    formData.append("role", inviteRole);
    const result = await inviteOrgMemberAction(undefined, formData);
    if (result.ok) {
      toast.success("Invitation sent");
      setInviteDialogOpen(false);
      setInviteEmail("");
      loadMembers();
      loadInvitations();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemoveMember(userId: string) {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("userId", userId);
    const result = await removeOrgMemberAction(undefined, formData);
    if (result.ok) {
      toast.success("Member removed");
      loadMembers();
    } else {
      toast.error(result.error);
    }
    setRemoveConfirm(null);
  }

  async function handleTransferOwnership(userId: string) {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("newOwnerId", userId);
    const result = await transferOwnershipAction(undefined, formData);
    if (result.ok) {
      toast.success("Ownership transferred");
      loadMembers();
    } else {
      toast.error(result.error);
    }
    setTransferConfirm(null);
  }

  async function handleSaveBranding() {
    setSaving(true);
    const formData = new FormData();
    formData.append("id", orgId);
    formData.append("name", branding.name);
    formData.append("brand_color", branding.brand_color);
    formData.append("brand_tagline", branding.brand_tagline);
    formData.append("logo_url", branding.logo_url);

    const result = await updateOrgAction(undefined, formData);
    if (result.ok) {
      toast.success("Branding saved");
    } else {
      toast.error(result.error ?? "Could not save branding");
    }
    setSaving(false);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("settings", JSON.stringify(settings));
    const result = await updateOrgSettingsAction(undefined, formData);
    if (result.ok) {
      toast.success("Settings saved");
    } else {
      toast.error(result.error ?? "Failed to save settings");
    }
    setSavingSettings(false);
  }

  async function handleCreateApiKey() {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("name", createApiKeyName);
    formData.append("scopes", JSON.stringify(createApiKeyScopes));
    const result = await createOrgApiKeyAction(undefined, formData);
    if (result.ok) {
      toast.success("API key created");
      toast.info(`Key: ${result.data?.key} (save this - it won't be shown again)`);
      setCreateApiKeyDialogOpen(false);
      setCreateApiKeyName("");
      setCreateApiKeyScopes(["read", "write"]);
      loadApiKeys();
    } else {
      toast.error(result.error ?? "Failed to create API key");
    }
  }

  async function handleDeleteApiKey(keyId: string) {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("keyId", keyId);
    const result = await deleteOrgApiKeyAction(undefined, formData);
    if (result.ok) {
      toast.success("API key deleted");
      loadApiKeys();
    } else {
      toast.error(result.error ?? "Failed to delete API key");
    }
  }

  async function handleCreateWebhook() {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("url", createWebhookUrl);
    formData.append("events", JSON.stringify(createWebhookEvents));
    const result = await createOrgWebhookAction(undefined, formData);
    if (result.ok) {
      toast.success("Webhook created");
      toast.info(`Secret: ${result.data?.secret} (save this - it won't be shown again)`);
      setCreateWebhookDialogOpen(false);
      setCreateWebhookUrl("");
      setCreateWebhookEvents(["invoice.created", "invoice.paid", "contract.signed"]);
      loadWebhooks();
    } else {
      toast.error(result.error ?? "Failed to create webhook");
    }
  }

  async function handleDeleteWebhook(webhookId: string) {
    const formData = new FormData();
    formData.append("orgId", orgId);
    formData.append("webhookId", webhookId);
    const result = await deleteOrgWebhookAction(undefined, formData);
    if (result.ok) {
      toast.success("Webhook deleted");
      loadWebhooks();
    } else {
      toast.error(result.error ?? "Failed to delete webhook");
    }
  }

  async function handleRevokeAllSessions() {
    const formData = new FormData();
    formData.append("orgId", orgId);
    const result = await revokeAllOrgSessionsAction(undefined, formData);
    if (result.ok) {
      toast.success("All sessions revoked");
    } else {
      toast.error(result.error ?? "Failed to revoke sessions");
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner": return "default";
      case "admin": return "secondary";
      case "member": return "outline";
      case "viewer": return "secondary";
      default: return "outline";
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "owner": return "Full control including billing, deletion, ownership transfer";
      case "admin": return "Manage members, projects, organization settings";
      case "member": return "Access projects, create invoices, contracts, time entries";
      case "viewer": return "Read-only access to projects and documents";
      default: return "";
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "members", label: "Members", icon: Users },
    { id: "invitations", label: "Invitations", icon: Mail },
    { id: "branding", label: "Branding", icon: Zap },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "api", label: "API Keys", icon: Terminal },
    { id: "webhooks", label: "Webhooks", icon: Globe },
    { id: "security", label: "Security", icon: Shield },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "advanced", label: "Advanced", icon: Settings },
  ].filter(t => {
    if (["advanced", "security"].includes(t.id) && !is_owner) return false;
    if (["billing", "integrations", "api", "webhooks"].includes(t.id) && !isAdmin) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
            <Badge variant="secondary">{org.slug}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {member_count} member{member_count !== 1 ? "s" : ""} · {user_role.charAt(0).toUpperCase() + user_role.slice(1)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Basic information about your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={settings.name as string || org.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    disabled={savingSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">Slug</Label>
                  <Input
                    id="org-slug"
                    value={org.slug}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Cannot be changed after creation</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-description">Description</Label>
                <Textarea
                  id="org-description"
                  value={(settings.description as string) || ""}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  placeholder="A brief description of your organization"
                  rows={3}
                  disabled={savingSettings}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-website">Website</Label>
                <Input
                  id="org-website"
                  value={(settings.website as string) || ""}
                  onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                  placeholder="https://example.com"
                  disabled={savingSettings}
                />
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Configure organization-wide preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Default Currency</h4>
                  <p className="text-sm text-muted-foreground">Currency used for new invoices and projects.</p>
                </div>
                <Select
                  value={(settings.default_currency as string) || "INR"}
                  onValueChange={(v) => setSettings({ ...settings, default_currency: v })}
                  disabled={savingSettings}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Default Language</h4>
                  <p className="text-sm text-muted-foreground">Language used for documents and emails.</p>
                </div>
                <Select
                  value={(settings.default_language as string) || "en"}
                  onValueChange={(v) => setSettings({ ...settings, default_language: v })}
                  disabled={savingSettings}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Timezone</h4>
                  <p className="text-sm text-muted-foreground">Timezone for scheduling and reports.</p>
                </div>
                <Select
                  value={(settings.timezone as string) || "Asia/Kolkata"}
                  onValueChange={(v) => setSettings({ ...settings, timezone: v })}
                  disabled={savingSettings}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    <SelectItem value="Europe/Berlin">Europe/Berlin (CET)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Week Starts On</h4>
                  <p className="text-sm text-muted-foreground">First day of the week for reports.</p>
                </div>
                <Select
                  value={(settings.week_start as string) || "monday"}
                  onValueChange={(v) => setSettings({ ...settings, week_start: v })}
                  disabled={savingSettings}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Members ({member_count})</h3>
              <p className="text-sm text-muted-foreground">Invite team members and manage their roles</p>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                  <DialogDescription>Enter their email and choose a role. They'll receive an invitation link.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin — manage members, projects, settings</SelectItem>
                        <SelectItem value="member">Member — access projects, create content</SelectItem>
                        <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleInvite} disabled={!inviteEmail}>Send Invitation</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-0">
              {loadingMembers ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.user_name)}`} alt={member.user_name} />
                              <AvatarFallback>{member.user_name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.user_name || "Unknown"}</p>
                              <p className="text-sm text-muted-foreground">{member.user_email}</p>
                              {member.user_id === org.owner_user_id && (
                                <Badge variant="default" className="mt-1 text-xs">Owner</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {member.joined_at ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Change Role */}
                            {isAdmin && member.user_id !== org.owner_user_id && member.role !== "owner" && (
                              <Select
                                value={member.role}
                                onValueChange={async (newRole) => {
                                  const formData = new FormData();
                                  formData.append("orgId", orgId);
                                  formData.append("userId", member.user_id);
                                  formData.append("role", newRole);
                                  const result = await updateOrgMemberRoleAction(undefined, formData);
                                  if (result.ok) {
                                    toast.success("Role updated");
                                    loadMembers();
                                  } else {
                                    toast.error(result.error);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {/* Remove Member */}
                            {isAdmin && member.user_id !== org.owner_user_id && (
                              <AlertDialog open={removeConfirm === member.id} onOpenChange={(open) => setRemoveConfirm(open ? member.id : null)}>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove {member.user_name} from the organization. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setRemoveConfirm(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveMember(member.user_id)}>Remove</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {/* Transfer Ownership */}
                            {is_owner && member.user_id !== org.owner_user_id && member.role !== "viewer" && (
                              <AlertDialog open={transferConfirm === member.id} onOpenChange={(open) => setTransferConfirm(open ? member.id : null)}>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                                    <Key className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {member.user_name} will become the new owner. You will be demoted to admin. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setTransferConfirm(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleTransferOwnership(member.user_id)}>Transfer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Role Legend */}
          <Card>
            <CardHeader>
              <CardTitle>Role permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { role: "owner", desc: "Full control including billing, deletion, ownership transfer" },
                  { role: "admin", desc: "Manage members, projects, organization settings" },
                  { role: "member", desc: "Access projects, create invoices, contracts, time entries" },
                  { role: "viewer", desc: "Read-only access to projects and documents" },
                ].map(({ role, desc }) => (
                  <div key={role} className="space-y-1 p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVITATIONS TAB */}
        <TabsContent value="invitations" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pending Invitations ({invitations.length})</h3>
              <p className="text-sm text-muted-foreground">Manage pending organization invitations</p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-0">
              {loadingInvitations ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h4 className="mt-2 text-lg font-medium">No pending invitations</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invitations will appear here once sent.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{inv.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Role: {inv.role} · Invited by {inv.invited_by_name} ({inv.invited_by_email})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {formatDate(inv.expires_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const formData = new FormData();
                            formData.append("orgId", orgId);
                            formData.append("invitationId", inv.id);
                            const result = await resendOrgInvitationAction(undefined, formData);
                            if (result.ok) {
                              toast.success("Invitation resent");
                              loadInvitations();
                            } else {
                              toast.error(result.error);
                            }
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            const formData = new FormData();
                            formData.append("orgId", orgId);
                            formData.append("invitationId", inv.id);
                            const result = await cancelOrgInvitationAction(undefined, formData);
                            if (result.ok) {
                              toast.success("Invitation cancelled");
                              loadInvitations();
                            } else {
                              toast.error(result.error);
                            }
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRANDING TAB */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand identity</CardTitle>
              <CardDescription>Customize how your organization appears on invoices, contracts, and client portals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization name</Label>
                  <Input
                    id="name"
                    value={branding.name}
                    onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={org.slug}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Cannot be changed after creation</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_color">Brand color</Label>
                  <Input
                    id="brand_color"
                    type="color"
                    value={branding.brand_color || "#2563EB"}
                    onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_tagline">Tagline</Label>
                  <Input
                    id="brand_tagline"
                    value={branding.brand_tagline}
                    onChange={(e) => setBranding({ ...branding, brand_tagline: e.target.value })}
                    placeholder="A short tagline for your organization"
                    disabled={saving}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    value={branding.logo_url}
                    onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">Used on invoices, contracts, and client portals. Recommended: 200×200px, transparent background.</p>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveBranding} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/50 bg-background p-6">
                <div className="flex items-start gap-4">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt={`${branding.name} logo`} className="h-12 w-12 rounded-lg object-contain border" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg text-white font-bold text-xl" style={{ backgroundColor: branding.brand_color || "#2563EB" }}>
                      {branding.name?.charAt(0)?.toUpperCase() || "O"}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{branding.name || org.name}</h3>
                    {branding.brand_tagline && <p className="text-sm text-muted-foreground">{branding.brand_tagline}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">stackivo.me/org/{org.slug}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BILLING TAB */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Billing & Subscription</CardTitle>
                  <CardDescription>Manage your organization's plan and payment method.</CardDescription>
                </div>
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Plan */}
              <div className="rounded-lg border border-border/50 bg-muted/30 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${getPlanBadgeStyles(subscription?.plan)}`}>
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{formatPlanName(subscription?.plan)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {subscription?.status === "active" ? "Active" : subscription?.status}
                        {subscription?.currentPeriodEnd && ` · Renews ${formatDate(subscription.currentPeriodEnd)}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/dashboard/settings?tab=billing">Manage</a>
                  </Button>
                </div>
              </div>

              {/* Trial Status */}
              {subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date() && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Trial Active</h4>
                      <p className="text-sm text-muted-foreground">
                        Trial ends on {formatDate(subscription.trialEndsAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Seats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Seats Used</h4>
                      <Badge variant="secondary">{member_count} / {getSeatLimit(subscription?.plan)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">All members count toward seats</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Billing Cycle</h4>
                      <Badge variant="outline">{subscription?.currentPeriodEnd ? "Monthly" : "—"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription?.currentPeriodEnd
                        ? `Next renewal: ${formatDate(subscription.currentPeriodEnd)}`
                        : "No active subscription"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Method */}
              <div className="rounded-lg border border-border/50 bg-background p-6">
                <h4 className="font-medium mb-4">Payment Method</h4>
                {subscription?.razorpaySubscriptionId ? (
                  <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="flex h-10 w-16 items-center justify-center rounded bg-white border">
                      <span className="text-xs font-mono text-muted-foreground">Razorpay</span>
                    </div>
                    <div>
                      <p className="font-medium">Razorpay Subscription</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {subscription.razorpaySubscriptionId.slice(0, 12)}...
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="ml-auto">
                      <a href="/dashboard/settings?tab=billing">Manage</a>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="flex h-10 w-16 items-center justify-center rounded bg-white border">
                      <span className="text-xs font-mono text-muted-foreground">Not set</span>
                    </div>
                    <div>
                      <p className="font-medium">No payment method</p>
                      <p className="text-sm text-muted-foreground">Add a payment method to enable auto-renewal</p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="ml-auto">
                      <a href="/dashboard/settings?tab=billing">Add Payment Method</a>
                    </Button>
                  </div>
                )}
              </div>

              {/* Invoice History */}
              <div>
                <h4 className="font-medium mb-4">Recent Invoices</h4>
                <p className="text-sm text-muted-foreground">Organization-level invoice history coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTEGRATIONS TAB */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect third-party services to your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Razorpay */}
                <IntegrationCard
                  name="Razorpay"
                  description="Accept payments via Razorpay (UPI, Cards, Netbanking, Wallets)"
                  icon={<CreditCard className="h-5 w-5" />}
                  connected={!!subscription?.razorpaySubscriptionId}
                  onConnect={() => toast.info("Razorpay integration coming soon")}
                  onConfigure={() => toast.info("Configure Razorpay coming soon")}
                />
                {/* Google Calendar */}
                <IntegrationCard
                  name="Google Calendar"
                  description="Sync meetings and events with Google Calendar"
                  icon={<Calendar className="h-5 w-5" />}
                  connected={false}
                  onConnect={() => toast.info("Google Calendar integration coming soon")}
                  onConfigure={() => toast.info("Configure Google Calendar coming soon")}
                />
                {/* Slack */}
                <IntegrationCard
                  name="Slack"
                  description="Get notifications and updates in Slack channels"
                  icon={<MessageSquare className="h-5 w-5" />}
                  connected={false}
                  onConnect={() => toast.info("Slack integration coming soon")}
                  onConfigure={() => toast.info("Configure Slack coming soon")}
                />
                {/* Email */}
                <IntegrationCard
                  name="Custom Email Domain"
                  description="Send emails from your own domain (e.g., invoices@yourcompany.com)"
                  icon={<Mail className="h-5 w-5" />}
                  connected={false}
                  onConnect={() => toast.info("Custom email domain coming soon")}
                  onConfigure={() => toast.info("Configure email domain coming soon")}
                />
                {/* Webhooks */}
                <IntegrationCard
                  name="Webhooks"
                  description="Receive real-time events via HTTP callbacks"
                  icon={<Zap className="h-5 w-5" />}
                  connected={webhooks.length > 0}
                  onConnect={() => setActiveTab("webhooks")}
                  onConfigure={() => setActiveTab("webhooks")}
                />
                {/* API */}
                <IntegrationCard
                  name="API Access"
                  description="Programmatic access to your organization data"
                  icon={<Terminal className="h-5 w-5" />}
                  connected={apiKeys.length > 0}
                  onConnect={() => setActiveTab("api")}
                  onConfigure={() => setActiveTab("api")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API KEYS TAB */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage API keys for programmatic access to your organization.</CardDescription>
                </div>
                <Button onClick={() => setCreateApiKeyDialogOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingApiKeys ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <KeyRound className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h4 className="mt-2 text-lg font-medium">No API keys yet</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create an API key to access the Stackivo API programmatically.
                  </p>
                  <Button className="mt-4" onClick={() => setCreateApiKeyDialogOpen(true)}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Create API Key
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Prefix: {key.key_prefix}... · Created {formatDate(key.created_at)}
                            {key.last_used_at && ` · Last used ${formatDate(key.last_used_at)}`}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {key.scopes.map((scope) => (
                              <Badge key={scope} variant="outline" className="text-xs">{scope}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => toast.info("View key not implemented yet")}>View Key</Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteApiKey(key.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {/* Create API Key Dialog */}
            <Dialog open={createApiKeyDialogOpen} onOpenChange={setCreateApiKeyDialogOpen}>
              <DialogTrigger asChild />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>Create a new API key for programmatic access.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key-name">Name</Label>
                    <Input
                      id="api-key-name"
                      value={createApiKeyName}
                      onChange={(e) => setCreateApiKeyName(e.target.value)}
                      placeholder="e.g., Production Server"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-key-scopes">Scopes</Label>
                    <div className="flex flex-wrap gap-2">
                      {["read", "write", "webhooks", "admin"].map((scope) => (
                        <label key={scope} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={createApiKeyScopes.includes(scope)}
                            onChange={(e) => setCreateApiKeyScopes(
                              e.target.checked
                                ? [...createApiKeyScopes, scope]
                                : createApiKeyScopes.filter(s => s !== scope)
                            )}
                          />
                          <span className="text-sm capitalize">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateApiKeyDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateApiKey}>Create API Key</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>Receive real-time events via HTTP callbacks.</CardDescription>
                </div>
                <Button onClick={() => setCreateWebhookDialogOpen(true)}>
                  <Zap className="mr-2 h-4 w-4" />
                  Create Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingWebhooks ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h4 className="mt-2 text-lg font-medium">No webhooks yet</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a webhook to receive real-time events.
                  </p>
                  <Button className="mt-4" onClick={() => setCreateWebhookDialogOpen(true)}>
                    <Zap className="mr-2 h-4 w-4" />
                    Create Webhook
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((hook) => (
                      <TableRow key={hook.id}>
                        <TableCell>
                          <div className="max-w-[300px] truncate font-mono text-sm">{hook.url}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {hook.events.map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={hook.status === "active" ? "success" : "secondary"}>{hook.status}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(hook.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">Test</Button>
                          <Button variant="ghost" size="icon">Edit</Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteWebhook(hook.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Create Webhook Dialog */}
              <Dialog open={createWebhookDialogOpen} onOpenChange={setCreateWebhookDialogOpen}>
                <DialogTrigger asChild />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Webhook</DialogTitle>
                    <DialogDescription>Create a new webhook to receive real-time events.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="webhook-url">URL</Label>
                      <Input
                        id="webhook-url"
                        type="url"
                        value={createWebhookUrl}
                        onChange={(e) => setCreateWebhookUrl(e.target.value)}
                        placeholder="https://your-app.com/webhook"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook-events">Events</Label>
                      <div className="flex flex-wrap gap-2">
                        {["invoice.created", "invoice.paid", "invoice.overdue", "contract.signed", "contract.declined", "project.created", "project.updated", "client.created", "payment.received", "payment.failed"].map((event) => (
                          <label key={event} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={createWebhookEvents.includes(event)}
                              onChange={(e) => setCreateWebhookEvents(
                                e.target.checked
                                  ? [...createWebhookEvents, event]
                                  : createWebhookEvents.filter(e => e !== event)
                              )}
                            />
                            <span className="text-sm">{event}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCreateWebhookDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreateWebhook}>Create Webhook</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY TAB */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security policies for your organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Two-Factor Authentication (2FA)</h4>
                    <p className="text-sm text-muted-foreground">Require all members to enable 2FA.</p>
                  </div>
                  <Switch checked={settings.require_2fa === true} onCheckedChange={(checked) => setSettings({ ...settings, require_2fa: checked })} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Enforce 2FA for Admins Only</h4>
                    <p className="text-sm text-muted-foreground">Only require 2FA for admin and owner roles.</p>
                  </div>
                  <Switch checked={settings.enforce_2fa_admins === true} onCheckedChange={(checked) => setSettings({ ...settings, enforce_2fa_admins: checked })} disabled={!settings.require_2fa} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Session Timeout</h4>
                    <p className="text-sm text-muted-foreground">Auto-logout after inactivity.</p>
                  </div>
                  <Select
                    value={(settings.session_timeout as string) || "24h"}
                    onValueChange={(v) => setSettings({ ...settings, session_timeout: v })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="4h">4 Hours</SelectItem>
                      <SelectItem value="8h">8 Hours</SelectItem>
                      <SelectItem value="24h">24 Hours</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">IP Allowlist</h4>
                    <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses.</p>
                  </div>
                  <Switch checked={settings.ip_allowlist_enabled === true} onCheckedChange={(checked) => setSettings({ ...settings, ip_allowlist_enabled: checked })} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Single Sign-On (SSO)</h4>
                    <p className="text-sm text-muted-foreground">Enable SAML/OIDC SSO for your organization.</p>
                  </div>
                  <Button variant="outline" onClick={() => toast.info("SSO configuration coming soon")}>
                    Configure SSO
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </div>
              <CardDescription>Irreversible security actions. Proceed with extreme caution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 p-4 rounded-lg border bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Revoke All Sessions</h4>
                    <p className="text-sm text-muted-foreground">Force all members to log in again. Useful after security incidents.</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" onClick={() => setRevokeAllSessionsOpen(true)}>
                        Revoke All Sessions
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will force all organization members to log in again. Useful after security incidents.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevokeAllSessions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Revoke All Sessions
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="space-y-4 p-4 rounded-lg border bg-destructive/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-destructive">Delete Organization</h4>
                    <p className="text-sm text-muted-foreground">Permanently delete this organization and all its data. This cannot be undone.</p>
                  </div>
                  <Button variant="destructive" asChild>
                    <a href={`/dashboard/organizations/${orgId}/delete`}>Delete</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>View all actions performed within your organization.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-4">
                <Input
                  placeholder="Filter by actor..."
                  value={activityFilters.actor}
                  onChange={(e) => setActivityFilters({ ...activityFilters, actor: e.target.value })}
                  className="w-[200px]"
                />
                <Input
                  placeholder="Filter by action..."
                  value={activityFilters.action}
                  onChange={(e) => setActivityFilters({ ...activityFilters, action: e.target.value })}
                  className="w-[200px]"
                />
                <Input
                  type="date"
                  value={activityFilters.dateFrom}
                  onChange={(e) => setActivityFilters({ ...activityFilters, dateFrom: e.target.value })}
                  className="w-[160px]"
                />
                <Input
                  type="date"
                  value={activityFilters.dateTo}
                  onChange={(e) => setActivityFilters({ ...activityFilters, dateTo: e.target.value })}
                  className="w-[160px]"
                />
                <Button variant="outline" onClick={() => { loadActivity(); setActivityPage(1); }}>
                  <Filter className="mr-2 h-4 w-4" /> Apply
                </Button>
              </div>

              {loadingActivity ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-10 w-10 text-muted-foreground" />
                  <h4 className="mt-2 text-lg font-medium">No activity yet</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Activity will appear here as members perform actions.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.action}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.actor_name} ({item.actor_email}) · {item.target_type}: {item.target_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" onClick={() => { setActivityPage(p => p - 1); loadActivity(); }} disabled={activityPage <= 1}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {activityPage}</span>
                <Button variant="outline" size="sm" onClick={() => { setActivityPage(p => p + 1); loadActivity(); }}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="space-y-6">
          {is_owner && (
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </div>
                <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transfer Ownership */}
                <div className="space-y-4 p-4 rounded-lg border bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Transfer Ownership</h4>
                      <p className="text-sm text-muted-foreground">Make another member the organization owner. You will become an admin.</p>
                    </div>
                    <Button variant="outline" onClick={() => {
                      const adminMember = members.find(m => m.role === "admin" && m.user_id !== org.owner_user_id);
                      if (adminMember) setTransferConfirm(adminMember.id);
                    }} disabled={!members.some(m => m.role === "admin" && m.user_id !== org.owner_user_id)}>
                      Transfer
                    </Button>
                  </div>
                </div>

                {/* Delete Organization */}
                <div className="space-y-4 p-4 rounded-lg border bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-destructive">Delete Organization</h4>
                      <p className="text-sm text-muted-foreground">Permanently delete this organization and all its data. This cannot be undone.</p>
                    </div>
                    <Button variant="destructive" asChild>
                      <a href={`/dashboard/organizations/${orgId}/delete`}>Delete</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!is_owner && (
            <Card>
              <CardContent className="py-12 text-center">
                <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Owner only</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Only the organization owner can access advanced settings like ownership transfer and deletion.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper components
function IntegrationCard({
  name,
  description,
  icon,
  connected,
  onConnect,
  onConfigure,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  onConnect: () => void;
  onConfigure: () => void;
}) {
  return (
    <div className="flex flex-col h-full p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{name}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Badge variant={connected ? "success" : "secondary"}>
          {connected ? "Connected" : "Not connected"}
        </Badge>
        <div className="flex gap-2">
          {connected ? (
            <Button variant="outline" size="sm" onClick={onConfigure}>
              Configure
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect}>
              Connect
            </Button>
          )}
      </div>
    </div>
  );
}

// Helper functions
function formatPlanName(plan?: string | null): string {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getPlanBadgeStyles(plan?: string | null): string {
  switch (plan) {
    case "free":
      return "bg-muted text-muted-foreground";
    case "pro":
      return "bg-primary/10 text-primary";
    case "business":
      return "bg-purple/10 text-purple";
    case "enterprise":
      return "bg-amber/10 text-amber";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getSeatLimit(plan?: string | null): string {
  switch (plan) {
    case "free":
      return "3";
    case "pro":
      return "10";
    case "business":
      return "50";
    case "enterprise":
      return "Unlimited";
    default:
      return "3";
  }
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}