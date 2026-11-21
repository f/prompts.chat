import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.privacy");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/privacy",
  });
}

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            prompts.chat is an open-source platform for collecting, organizing, and sharing AI prompts. 
            All prompts shared on this platform are released under the{" "}
            <Link href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              CC0 (Creative Commons Zero)
            </Link>{" "}
            license, meaning they are in the public domain.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Information We Collect</h2>
          <p className="text-muted-foreground">
            When you create an account, we collect:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Email address (for authentication)</li>
            <li>Username and display name</li>
            <li>Profile information you choose to provide</li>
          </ul>
          <p className="text-muted-foreground">
            When you use the platform, we collect:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Prompts you create and share</li>
            <li>Categories and tags you assign to prompts</li>
            <li>Analytics data through Google Analytics to understand usage patterns (can be disabled on self-hosted instances)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We use collected information to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Provide and maintain the service</li>
            <li>Associate prompts with your account</li>
            <li>Enable discovery of prompts by other users</li>
            <li>Improve the platform based on usage patterns</li>
            <li>Detect and prevent abuse, spam, and unusual activity</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Account Monitoring & Flagging</h2>
          <p className="text-muted-foreground">
            We monitor account activity to maintain platform quality and prevent abuse. If unusual or abusive 
            activity is detected, your account may be flagged. This information is stored internally and includes:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Flag status (whether your account is flagged)</li>
            <li>Date when the flag was applied</li>
            <li>Reason for the flag</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            Flagged accounts are subject to restrictions including a daily limit of 5 prompts and automatic 
            unlisting of new prompts. This data is only visible to administrators and is used solely for 
            platform integrity purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Data Sharing</h2>
          <p className="text-muted-foreground">
            Prompts you share are public and released under CC0. Your username will be displayed 
            alongside your prompts. We do not sell your personal information to third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Analytics & Cookies</h2>
          <p className="text-muted-foreground">
            We use essential cookies for authentication and session management. We use Google Analytics 
            to understand how the service is used, including tracking events such as prompt views, searches, 
            and interactions. Analytics records whether a visit is signed in, and, if you accept analytics 
            cookies, a pseudonymous identifier derived from your account (never your email, username, or 
            account id) so visits can be counted across devices. On self-hosted instances, analytics can be disabled by not setting the 
            <code className="px-1 py-0.5 bg-muted rounded text-xs">GOOGLE_ANALYTICS_ID</code> environment variable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your Rights & CC0 License</h2>
          <p className="text-muted-foreground">
            You can:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Access and update your account information</li>
            <li>Download any prompts directly from the platform (all prompts are CC0 and publicly available)</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            <strong>Important:</strong> Because all prompts are released under the CC0 license and belong to 
            the public domain, they cannot be deleted or removed once published. This is by design—CC0 content 
            is free for anyone to use, modify, and distribute without restriction. Account deletion does not 
            remove prompts you have contributed, as they are part of the public commons.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Open Source</h2>
          <p className="text-muted-foreground">
            This platform is open source. You can review the code and self-host your own instance at{" "}
            <Link href="https://github.com/f/prompts.chat" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              GitHub
            </Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            For privacy-related inquiries, please open an issue on our GitHub repository.
          </p>
        </section>
      </div>
    </div>
  );
}
