import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex h-[calc(100svh-64px)] w-full max-w-5xl flex-col justify-between gap-10 px-4 py-8 overflow-hidden">
      <section className="flex flex-1 flex-col justify-center gap-6 text-center md:text-left">
        <span className="mx-auto inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary md:mx-0">
          Dark mode inspired by shadcn/ui
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Track your Spin &amp; Go performance with an elegant and readable interface.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:mx-0">
          Consolidate your imports, monitor tournaments, and visualize EV curves with a layout designed for late-night sessions.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center md:items-start">
          <Link
            href="/dashboard"
            className={buttonVariants({ size: "default", variant: "default" })}
          >
            Go to dashboard
          </Link>
          <Link
            href="/imports"
            className={buttonVariants({ size: "default", variant: "outline" })}
          >
            Manage imports
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-2 md:grid-cols-3">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Key indicators</CardTitle>
            <CardDescription>
              Clear KPIs to follow your volume and profit.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Monitor ROI, CEV, and completed tournaments at a glance.
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Streamlined imports</CardTitle>
            <CardDescription>
              Drag-and-drop files or folders to process them.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The upload flow saves time and keeps mistakes at bay.
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Readable EV curve</CardTitle>
            <CardDescription>
              Analyze real vs expected gains over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            High-contrast dark visualization, perfect for night sessions.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
