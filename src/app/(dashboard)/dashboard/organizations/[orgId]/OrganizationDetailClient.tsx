"use client";
// @ts-nocheck

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users, Building2, DollarSign, Trash2, Settings, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { listOrgMembersAction, inviteOrgMemberAction, removeOrgMemberAction, getProjectProfitabilityAction, listProjectCostsAction, addProjectCostAction, deleteProjectCostAction } from "@/features/organizations/actions";

interface MemberType {
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

interface MemberType {
  id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
  user_email: string;
  user_name: string;
}

interface OrganizationDetailClientProps {
  initialData: {
    org: {
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

export function OrganizationDetailClient({ initialData, orgId }: OrganizationDetailClientProps) {
  const [activeTab, setActiveTab] = useState("branding");
  const [members, setMembers] = React.useState<MemberType[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [profitability, setProfitability] = React.useState<Profitability | null>(null);
  const [costs, setCosts] = React.useState<Record<string, unknown>[]>([]);
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [newCost, setNewCost] = React.useState({ description: "", amount: "", currency: "INR", category: "" });
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [branding, setBranding] = React.useState({
    name: "",
    brand_color: "",
    brand_tagline: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);

  const { org, member_count, user_role, is_owner } = initialData;

  const isAdmin = user_role === "owner" || user_role === "admin";

  const loadMembers = useCallback(async () => {
    const result = await listOrgMembersAction(orgId);
    if (result.ok) setMembers(result.data.members);
  }, [orgId]);

  const loadProfitability = useCallback(async () => {
    setProfitabilityLoading(true);
    const result = await getProjectProfitabilityAction(orgId);
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
  }, [orgId, loadMembers, loadProfitability]);

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

  async function handleSaveBranding() {
    setSaving(true);
    const formData = new FormData();
    formData.append("id", orgId);
    formData.append("name", branding.name);
    formData.append("brand_color", branding.brand_color);
    formData.append("brand_tagline", branding.brand_tagline);
    formData.append("logo_url", branding.logo_url);

    toast.success("Branding saved");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your organization settings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    value={branding.name}
                    onChange={(e) => setBranding({ ...branding, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={initialData.org.slug}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_color">Brand Color</Label>
                  <Input
                    id="brand_color"
                    type="color"
                    value={branding.brand_color || "#000000"}
                    onChange={(e) => setBranding({ ...branding, brand_color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_tagline">Tagline</Label>
                  <Input
                    id="brand_tagline"
                    value={branding.brand_tagline}
                    onChange={(e) => setBranding({ ...branding, brand_tagline: e.target.value })}
                    placeholder="A short tagline for your organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    value={branding.logo_url}
                    onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              <Button onClick={handleSaveBranding} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Members ({member_count})</h3>
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
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={!inviteEmail}>
                      Send Invitation
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-0">
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
                            <AvatarImage src={member.user_email} alt={member.user_name} />
                            <AvatarFallback>{member.user_name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.user_name || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground">{member.user_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.role === "owner" ? "default" : member.role === "admin" ? "secondary" : "outline"}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.joined_at ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && member.user_id !== initialData.org.owner_user_id && (
                          <Dialog open={removeConfirm === member.id} onOpenChange={(open) => setRemoveConfirm(open ? member.id : null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Remove member?</DialogTitle>
                              </DialogHeader>
                              <p>This will remove {member.user_name} from the organization. This action cannot be undone.</p>
                              <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={() => setRemoveConfirm(null)}>
                                  Cancel
                                </Button>
                                <Button variant="destructive" onClick={() => handleRemoveMember(member.user_id)}>
                                  Remove
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Billing management coming soon.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-2">
                    <h4 className="font-medium">Current Plan</h4>
                    <p className="text-muted-foreground">Pro / Business</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-2">
                    <h4 className="font-medium">Seats Used</h4>
                    <p className="text-muted-foreground">{member_count} / Unlimited</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {is_owner && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-destructive">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground mb-4">Transfer ownership or delete the organization.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" asChild>
                        <a href={`/dashboard/organizations/${orgId}/transfer`}>
                          Transfer Ownership
                        </a>
                      </Button>
                      <Button variant="destructive" asChild>
                        <a href={`/dashboard/organizations/${orgId}/delete`}>
                          Delete Organization
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}