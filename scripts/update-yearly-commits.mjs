import { readFile, writeFile } from 'node:fs/promises';

const login = process.env.GITHUB_LOGIN || 'Subham-KRLX';
const token = process.env.GH_TOKEN;

if (!token) {
  throw new Error('GH_TOKEN is required');
}

const now = new Date();
const year = now.getUTCFullYear();

const userResponse = await fetch(`https://api.github.com/users/${login}`, {
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': `${login}-profile-readme`
  }
});
const userPayload = await userResponse.json();
if (!userResponse.ok) {
  throw new Error(`GitHub user request failed: ${JSON.stringify(userPayload)}`);
}

const startYear = new Date(userPayload.created_at).getUTCFullYear();
const yearFields = [];
for (let candidate = startYear; candidate <= year; candidate += 1) {
  const from = `${candidate}-01-01T00:00:00Z`;
  const to = candidate === year ? now.toISOString() : `${candidate}-12-31T23:59:59Z`;
  yearFields.push(`
    y${candidate}: contributionsCollection(from: "${from}", to: "${to}") {
      totalCommitContributions
    }
  `);
}

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': `${login}-profile-readme`
  },
  body: JSON.stringify({
    query: `
      query($login: String!) {
        user(login: $login) {
          ${yearFields.join('\n')}
        }
      }
    `,
    variables: { login }
  })
});

const payload = await response.json();
if (!response.ok || payload.errors) {
  throw new Error(`GitHub API request failed: ${JSON.stringify(payload.errors || payload)}`);
}

const commitsByYear = payload.data.user;
const currentYearCommits = commitsByYear[`y${year}`].totalCommitContributions;
const allTimeCommits = Object.values(commitsByYear).reduce(
  (total, period) => total + period.totalCommitContributions,
  0
);
const badge = [
  '    <!-- yearly-commits:start -->',
  `    <img src="https://img.shields.io/badge/${year}_Public_Commits-${currentYearCommits}-F6C85F?style=for-the-badge&logo=git&logoColor=black" alt="${currentYearCommits} public commit contributions in ${year}"/>`,
  `    <img src="https://img.shields.io/badge/All_Time_Public_Commits-${allTimeCommits}-FF6B6B?style=for-the-badge&logo=github&logoColor=white" alt="${allTimeCommits} all-time public commit contributions"/>`,
  '    <!-- yearly-commits:end -->'
].join('\n');

const readmePath = new URL('../README.md', import.meta.url);
const readme = await readFile(readmePath, 'utf8');
const markerPattern = /    <!-- yearly-commits:start -->[\s\S]*?    <!-- yearly-commits:end -->/;

if (!markerPattern.test(readme)) {
  throw new Error('Yearly commit markers were not found in README.md');
}

await writeFile(readmePath, readme.replace(markerPattern, badge));
console.log(`Updated ${year} commits to ${currentYearCommits} and all-time commits to ${allTimeCommits}`);
