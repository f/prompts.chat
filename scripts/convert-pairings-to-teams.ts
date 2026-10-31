/**
 * Converts "better together" bot pairings (bot_pairings) into initial bot teams.
 *
 * Every group of bots connected through pairings becomes one team: its members are the group's
 * live bots, each pairing becomes a handoff from the older bot to the newer one labelled with the
 * pairing note, the title is built from the bot names, and the team belongs to the author who owns
 * most of its bots (or the owner of its private bots, since a team may only include its own author's
 * private bots). Pairings are left untouched. Groups whose exact member set already exists as a
 * team are skipped, so the script can be run again safely.
 *
 * Usage:
 *   npx tsx scripts/convert-pairings-to-teams.ts                  # dry run: print the teams it would create
 *   npx tsx scripts/convert-pairings-to-teams.ts --apply          # create them
 *   npx tsx scripts/convert-pairings-to-teams.ts --max-members 8  # skip groups larger than 8 bots (2 to 12)
 */

import { PrismaClient } from "@prisma/client";
import { parseMaxMembers, teamsFromPairings, type ConversionBot, type SkippedGroup } from "../src/lib/bots/team-conversion";
import { MAX_TEAM_LINKS, MAX_TEAM_MEMBERS } from "../src/lib/bots/team-schema";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const maxIndex = argv.indexOf("--max-members");
  const maxMembers = maxIndex === -1 ? MAX_TEAM_MEMBERS : parseMaxMembers(argv[maxIndex + 1]);
  return { apply, maxMembers };
}

async function uniqueSlug(title: string, reserved: Set<string>): Promise<string> {
  const base = slugify(title) || "team";
  const taken = await prisma.botTeam.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  const slugs = new Set([...taken.map((team) => team.slug), ...reserved]);
  let slug = base;
  for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
  reserved.add(slug);
  return slug;
}

async function main() {
  const { apply, maxMembers } = parseArgs(process.argv.slice(2));

  const pairings = await prisma.botPairing.findMany({
    orderBy: { createdAt: "asc" },
    select: { fromId: true, toId: true, note: true },
  });
  const botIds = [...new Set(pairings.flatMap((pairing) => [pairing.fromId, pairing.toId]))];
  const botRecords = await prisma.prompt.findMany({
    where: { id: { in: botIds }, type: "BOT", deletedAt: null },
    select: { id: true, title: true, authorId: true, createdAt: true, isPrivate: true },
  });
  const bots = new Map<string, ConversionBot>(botRecords.map((bot) => [bot.id, bot]));

  const existingTeams = await prisma.botTeam.findMany({ select: { members: { select: { botId: true } } } });
  const { teams, skipped } = teamsFromPairings(pairings, bots, {
    existingMemberSets: existingTeams.map((team) => team.members.map((member) => member.botId)),
    maxMembers,
  });

  console.log(`${pairings.length} pairings between ${bots.size} live bots`);
  console.log(`${teams.length} teams to create, ${skipped.length} groups skipped`);
  for (const group of skipped) {
    const reasons: Record<SkippedGroup["reason"], string> = {
      exists: "a team with these bots exists",
      too_large: `more than ${maxMembers} bots`,
      too_many_links: `more than ${MAX_TEAM_LINKS} handoffs`,
      private_bots: "private bots of more than one author",
    };
    const reason = reasons[group.reason];
    console.log(`  skipped (${reason}): ${group.botIds.map((id) => bots.get(id)?.title ?? id).join(", ")}`);
  }

  const reserved = new Set<string>();
  for (const team of teams) {
    const slug = await uniqueSlug(team.title, reserved);
    console.log(`\n${apply ? "Creating" : "Would create"} "${team.title}" (/bots/teams/${slug})`);
    for (const member of team.members) console.log(`  - ${bots.get(member.botId)!.title}`);
    for (const link of team.links) {
      console.log(`  ${bots.get(link.fromBotId)!.title} -> ${bots.get(link.toBotId)!.title}${link.label ? `: ${link.label}` : ""}`);
    }
    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      const created = await tx.botTeam.create({
        data: {
          slug,
          title: team.title,
          description: team.description,
          authorId: team.authorId,
          members: {
            create: team.members.map((member, order) => ({
              botId: member.botId,
              role: member.role ?? null,
              description: member.description ?? null,
              order,
            })),
          },
        },
        select: { id: true },
      });
      if (team.links.length > 0) {
        await tx.botTeamLink.createMany({
          data: team.links.map((link, order) => ({ teamId: created.id, ...link, order })),
        });
      }
    });
  }

  if (!apply && teams.length > 0) console.log("\nDry run: nothing was written. Run again with --apply to create these teams.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
