import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Star, Briefcase, MapPin, Languages, Calendar, Clock, ArrowRight, ExternalLink, CheckCircle2, Building2, User, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrencyAmount } from "@/lib/format";
import {
  getPublicProfileBySlug,
  getPublicProfileStats,
  getPublicPortfolio,
  getPublicProfileReviews,
} from "@/features/profile/public-profile-server";

function getDisplayName(profile: { display_name: string | null; full_name: string | null } | null): string {
  if (!profile) return "";
  return profile.display_name?.trim() || profile.full_name?.trim() || "";
}

function getInitials(name: string | null | undefined): string {
  const safe = (name ?? "").trim();
  if (!safe) return "SK";
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]![0] ?? "";
  const last = parts[parts.length - 1]![0] ?? "";
  return `${first}${last}`.toUpperCase() || "SK";
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  
  if (!profile) {
    return { title: "Profile Not Found | Stackivo" };
  }

  const name = getDisplayName(profile) || profile.full_name || "Freelancer";
  const title = profile.public_seo_title || `${name} | Stackivo`;
  const description = profile.public_seo_description || profile.public_bio || profile.bio || `${name}'s public profile on Stackivo`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.public_og_image ? [profile.public_og_image] : [],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: profile.public_og_image ? [profile.public_og_image] : [],
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const [stats, portfolio, reviews] = await Promise.all([
    getPublicProfileStats(profile.id),
    getPublicPortfolio(profile.id, 6),
    getPublicProfileReviews(profile.id, 5),
  ]);

  const displayName = getDisplayName(profile) || profile.full_name || "Freelancer";
  const initials = getInitials(displayName);
  const businessName = profile.business_name || profile.legal_name || profile.full_name;

  const averageRating = stats?.average_rating ?? 0;
  const stars = Math.round(averageRating * 10) / 10;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b" style={{ borderTop: `4px solid ${profile.brand_color || "#0066CC"}` }}>
        <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: profile.brand_color || "#0066CC" }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{displayName}</h1>
                  {profile.role && <p className="text-lg text-muted-foreground mt-1">{profile.role}</p>}
                  {businessName && businessName !== displayName && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {businessName}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-4 flex-wrap">
                    {stats && stats.verified_reviews > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{stars}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-5 w-5 ${star <= stars ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {stats.verified_reviews} review{stats.verified_reviews !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    {stats && stats.completed_projects > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4" />
                        <span>{stats.completed_projects} project{stats.completed_projects !== 1 ? "s" : ""} completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(profile.public_bio || profile.bio || profile.brand_intro) && (
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p>{profile.public_bio || profile.bio || profile.brand_intro}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-4">
                {profile.public_location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{profile.public_location}</span>
                  </div>
                )}
                {profile.public_availability && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{profile.public_availability}</span>
                  </div>
                )}
                {profile.public_languages && profile.public_languages.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Languages className="h-4 w-4" />
                    <span>{profile.public_languages.join(", ")}</span>
                  </div>
                )}
                {profile.public_starting_rate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Starting at {formatCurrencyAmount(profile.public_starting_rate, profile.public_starting_rate_currency ?? "INR")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Card */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 h-fit bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Want to work together?</p>
                    <Button
                      className="w-full mt-2 h-12 text-lg"
                      style={{ backgroundColor: profile.brand_color || "#0066CC" }}
                      onClick={() => handleCtaClick(profile)}
                    >
                      {profile.public_cta_text || "Start a project"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <a href={`mailto:${profile.email}`} className="hover:underline">{profile.email}</a>
                    </div>
                    {profile.business_email && profile.business_email !== profile.email && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Mail className="h-4 w-4 shrink-0" />
                        <a href={`mailto:${profile.business_email}`} className="hover:underline">{profile.business_email}</a>
                      </div>
                    )}
                    {profile.business_phone && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0" />
                        <a href={`tel:${profile.business_phone}`} className="hover:underline">{profile.business_phone}</a>
                      </div>
                    )}
                    {profile.website && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex-1 truncate">
                          {profile.website}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      {(profile.public_services && profile.public_services.length > 0) || (profile.public_industries && profile.public_industries.length > 0) ? (
        <section className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            {profile.public_services && profile.public_services.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Services
                </h2>
                <div className="flex flex-wrap gap-2">
                  {profile.public_services.map((service, i) => (
                    <Badge key={i} variant="secondary" className="text-sm">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.public_industries && profile.public_industries.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Industries
                </h2>
                <div className="flex flex-wrap gap-2">
                  {profile.public_industries.map((industry, i) => (
                    <Badge key={i} variant="secondary" className="text-sm">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Portfolio */}
      {portfolio && portfolio.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8 bg-muted/30">
          <div className="space-y-8">
            <h2 className="text-2xl font-bold">Selected Work</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {portfolio.map((item) => (
                <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                  {item.cover_image_url && (
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <img
                        src={item.cover_image_url}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      {item.category && <Badge variant="secondary" className="text-xs">{item.category}</Badge>}
                      {item.industry && <Badge variant="outline" className="text-xs">{item.industry}</Badge>}
                      {item.budget_range && <Badge variant="outline" className="text-xs">{item.budget_range}</Badge>}
                      {item.duration && <Badge variant="outline" className="text-xs">{item.duration}</Badge>}
                    </div>
                    {item.technologies && item.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.technologies.slice(0, 6).map((tech, i) => (
                          <Badge key={i} variant="secondary" className="text-xs h-5 px-2">{tech}</Badge>
                        ))}
                      </div>
                    )}
                    {item.client_name && (
                      <p className="text-xs text-muted-foreground">
                        Client: {item.client_name}
                        {item.client_industry && ` · {item.client_industry}`}
                      </p>
                    )}
                    {item.testimonial && (
                      <blockquote className="border-l-2 pl-3 italic text-sm text-muted-foreground">
                        &ldquo;{item.testimonial}&rdquo;
                      </blockquote>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Client Reviews</h2>
              {stats && stats.verified_reviews > 5 && (
                <p className="text-sm text-muted-foreground">
                  Showing 5 of {stats.verified_reviews} reviews
                </p>
              )}
            </div>
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border-primary/10">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm font-medium">
                            {review.client_name?.charAt(0)?.toUpperCase() || "C"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{review.client_name || "Client"}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.project_name && `Project: ${review.project_name} · `}
                            {new Date(review.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-5 w-5 ${star <= review.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                    <h4 className="font-medium">{review.title}</h4>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{review.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      {stats && (stats.completed_projects > 0 || stats.verified_reviews > 0) && (
        <section className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8 bg-muted/30">
          <h2 className="text-2xl font-bold mb-8 text-center">At a Glance</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Completed Projects" value={stats.completed_projects} />
            <StatCard icon={<Star className="h-5 w-5" />} label="Verified Reviews" value={stats.verified_reviews} />
            <StatCard icon={<Star className="h-5 w-5 fill-warning text-warning" />} label="Average Rating" value={stats.average_rating ? stars.toFixed(1) : "—"} />
            <StatCard icon={<User className="h-5 w-5" />} label="Repeat Clients" value={stats.repeat_clients} />
            <StatCard icon={<Building2 className="h-5 w-5" />} label="Total Project Value" value={formatCurrencyAmount(stats.total_project_value || 0, "INR")} />
            <StatCard icon={<Clock className="h-5 w-5" />} label="On-Time Delivery" value={stats.on_time_delivery_rate ? `${stats.on_time_delivery_rate}%` : "—"} />
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8 text-center">
        <p className="text-lg text-muted-foreground mb-6">Ready to start your project?</p>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          style={{ backgroundColor: profile.brand_color || "#0066CC" }}
          onClick={() => handleCtaClick(profile)}
        >
          {profile.public_cta_text || "Start a project"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Powered by <a href="https://stackivo.com" target="_blank" rel="noopener noreferrer" className="underline">Stackivo</a>
        </p>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5 text-center space-y-2">
        <div className="flex justify-center text-primary">{icon}</div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      </CardContent>
    </Card>
  );
}

function handleCtaClick(profile: Awaited<ReturnType<typeof getPublicProfileBySlug>>) {
  const action = profile?.public_cta_action || "enquiry";
  switch (action) {
    case "calendly":
      // TODO: Open Calendly link from profile
      break;
    case "custom_url":
      if (profile?.public_custom_domain) {
        window.open(profile.public_custom_domain, "_blank", "noopener,noreferrer");
      }
      break;
    case "enquiry":
    default:
      // Scroll to contact or open enquiry modal
      document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
      break;
  }
}