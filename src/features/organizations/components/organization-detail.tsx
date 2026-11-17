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
import { UserPlus, Users, Building2, DollarSign, Trash2, Save, Loader2, ArrowRight, Shield, BarChart3, CreditCard, Key, Settings } from "lucide-react";
import { toast } from "sonner";
import { listOrgMembersAction, inviteOrgMemberAction, removeOrgMemberAction, transferOwnershipAction, updateOrgMemberRoleAction, getOrgProfitabilityAction, updateOrgAction } from "../actions";
import { formatCurrency } from "@/lib/utils";

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

interface OrganizationDetailProps {
  initialData: {
    org: {
      id: string;
      name: string;
      slug: string;
      owner_user_id: string;
      brand_color: string | null;
      brand_tagline: string | null;
      logo_url: string | null;
    };
    member_count: number;
    user_role: string;
    is_owner: boolean;
  };
  orgId: string;
}

export function OrganizationDetail({ initialData, orgId }: OrganizationDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");
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

  useEffect(() => {
    setBranding({
      name: initialData.org.name,
      brand_color: initialData.org.brand_color || "",
      brand_tagline: initialData.org.brand_tagline || "",
      logo_url: initialData.org.logo_url || "",
    });
    loadMembers();
    loadProfitability();
  }, [orgId, loadMembers, loadProfitability, initialData]);

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
      case "owner": return "Full control including billing and deletion";
      case "admin": return "Manage members, projects, and settings";
      case "member": return "Access to projects and create content";
      case "viewer": return "Read-only access to projects";
      default: return "";
    }
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href={`/dashboard/organizations/${orgId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </a>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Profitability Summary */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold tabular-nums">
                  {profitability ? formatCurrency(profitability.totalRevenue) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Costs</p>
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  {profitability ? formatCurrency(profitability.totalCosts) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Profit</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: profitability && profitability.totalProfit >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
                  {profitability ? formatCurrency(profitability.totalProfit) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Margin</p>
                <p className="text-2xl font-bold tabular-nums">
                  {profitability ? `${profitability.overallMargin.toFixed(1)}%` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Project Breakdown */}
          {profitability && profitability.projects.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project profitability</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitability.projects.map((project) => (
                      <TableRow key={project.project_id}>
                        <TableCell className="font-medium">{project.project_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(project.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{formatCurrency(project.costs)}</TableCell>
                        <TableCell className="text-right tabular-nums" style={{ color: project.profit >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
                          {formatCurrency(project.profit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {project.margin.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {profitability && profitability.projects.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No project data yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Projects with paid invoices and recorded costs will appear here.
                </p>
              </CardContent>
            </Card>
          )}

          {profitabilityLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading profitability…</p>
              </CardContent>
            </Card>
          )}
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
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member" | "viewer")}>
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Pro Plan</h4>
                      <p className="text-sm text-muted-foreground">Active · Renews monthly</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/dashboard/settings?tab=billing">Manage</a>
                  </Button>
                </div>
              </div>

              {/* Seats */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Seats Used</h4>
                      <Badge variant="secondary">{member_count} / Unlimited</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">All members count toward seats</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Billing Cycle</h4>
                      <Badge variant="outline">Monthly</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Next renewal: 1st of next month</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Method Placeholder */}
              <div className="rounded-lg border border-border/50 bg-background p-6">
                <h4 className="font-medium mb-4">Payment Method</h4>
                <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                  <div className="flex h-10 w-16 items-center justify-center rounded bg-white border">
                    <span className="text-xs font-mono text-muted-foreground">•••• 4242</span>
                  </div>
                  <div>
                    <p className="font-medium">Visa ending in 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/28</p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="ml-auto">
                    <a href="/dashboard/settings?tab=billing">Update</a>
                  </Button>
                </div>
              </div>

              {/* Invoice History */}
              <div>
                <h4 className="font-medium mb-4">Recent Invoices</h4>
                <p className="text-sm text-muted-foreground">Organization-level invoice history coming soon.</p>
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
                <Key className="mx-auto h-12 w-12 text-muted-foreground" />
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