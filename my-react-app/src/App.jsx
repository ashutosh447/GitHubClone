// src/App.jsx
import { useEffect, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import "./App.css";

const GITHUB_USERNAME = "shreeramk";

const TABS = [
  { id: "Overview", label: "Overview", icon: "📑" },
  { id: "Repositories", label: "Repositories", icon: "📁", count: 31 },
  { id: "Projects", label: "Projects", icon: "🧱" },
  { id: "Packages", label: "Packages", icon: "📦", count: 5 },
  { id: "Stars", label: "Stars", icon: "⭐", count: 6 },
];

const mockPopularRepos = [
  {
    name: "Complete-Python-3-Bootcamp",
    description: "Course Files For Complete Python 3 Bootcamp Course on Udemy",
    language: "Jupyter Notebook",
    stars: 42,
    forks: 18,
  },
  {
    name: "flutter_login_ui",
    description: "A Flutter login UI example",
    language: "Dart",
    stars: 15,
    forks: 3,
  },
  {
    name: "kafkajs",
    description: "A modern Apache Kafka client for node.js",
    language: "JavaScript",
    stars: 120,
    forks: 25,
  },
  {
    name: "node-opcua-logger",
    description: "An OPCUA Client for logging data to InfluxDB",
    language: "JavaScript",
    stars: 9,
    forks: 2,
  },
];

const formatJoinedDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const toISODate = (date) => date.toISOString().slice(0, 10);
const generateMockContributions = (startDate, endDate) => {
  const data = [];
  const d = new Date(startDate);
  const end = new Date(endDate);

  while (d <= end) {
    const rnd = Math.random();
    let count = 0;
    if (rnd > 0.7) count = Math.floor(Math.random() * 8) + 1;
    data.push({ date: toISODate(d), count });
    d.setDate(d.getDate() + 1);
  }

  return data;
};

const getHeatmapOption = (values, startDate, endDate) => {
  const maxCount = Math.max(1, ...values.map((v) => (v.count ? v.count : 0)));

  const startStr = toISODate(startDate);
  const endStr = toISODate(endDate);

  return {
    tooltip: {
      formatter: (p) =>
        `${p.value[0]}: ${p.value[1]} contribution${
          p.value[1] === 1 ? "" : "s"
        }`,
    },
    grid: { top: 0, bottom: 0, left: 0, right: 0 },
    visualMap: {
      show: false,
      min: 0,
      max: maxCount,
      inRange: {
        color: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
      },
    },
    calendar: {
      range: [startStr, endStr],
      cellSize: ["auto", 13],
      splitLine: { show: false },
      yearLabel: { show: false },
      itemStyle: {
        borderWidth: 1,
        borderColor: "#fff",
      },
      dayLabel: {
        firstDay: 1,
        nameMap: ["", "Mon", "", "Wed", "", "Fri", ""],
      },
      monthLabel: {
        nameMap: "en",
        margin: 10,
      },
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: values.map((v) => [v.date, v.count]),
      },
    ],
  };
};

function App() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [contributions, setContributions] = useState([]);
  const [totalContributions, setTotalContributions] = useState(0);
  const [loadingContrib, setLoadingContrib] = useState(true);
  const [contribInfo, setContribInfo] = useState("");

  const [activeTab, setActiveTab] = useState("Overview");

  const startDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);
  const endDate = useMemo(() => new Date(), []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await fetch(
          `https://api.github.com/users/${GITHUB_USERNAME}`
        );
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        setLoadingContrib(true);

        const token = import.meta.env.VITE_GITHUB_TOKEN;

        if (!token) {
          const mock = generateMockContributions(startDate, endDate);
          setContributions(mock);
          setTotalContributions(
            mock.reduce((sum, d) => sum + (d.count || 0), 0)
          );
          setContribInfo(
            "Using mock data (no VITE_GITHUB_TOKEN set). Layout still matches GitHub."
          );
          return;
        }

        const query = `
          query($userName: String!) {
            user(login: $userName) {
              contributionsCollection {
                contributionCalendar {
                  totalContributions
                  weeks {
                    contributionDays {
                      date
                      contributionCount
                    }
                  }
                }
              }
            }
          }
        `;

        const body = JSON.stringify({
          query,
          variables: { userName: GITHUB_USERNAME },
        });

        const res = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body,
        });

        if (!res.ok) throw new Error(`GitHub GraphQL error: ${res.status}`);

        const json = await res.json();
        const calendar =
          json?.data?.user?.contributionsCollection?.contributionCalendar;

        if (!calendar) throw new Error("No contribution calendar in response");

        const days = calendar.weeks.flatMap((week) =>
          week.contributionDays.map((day) => ({
            date: day.date,
            count: day.contributionCount,
          }))
        );

        setContributions(days);
        setTotalContributions(calendar.totalContributions || 0);
        setContribInfo("Loaded from GitHub GraphQL API.");
      } catch (err) {
        console.error(err);
        const mock = generateMockContributions(startDate, endDate);
        setContributions(mock);
        setTotalContributions(mock.reduce((sum, d) => sum + (d.count || 0), 0));
        setContribInfo("GitHub API failed, showing mock data for layout only.");
      } finally {
        setLoadingContrib(false);
      }
    };

    fetchContributions();
  }, [startDate, endDate]);

  const heatmapOption = useMemo(
    () => getHeatmapOption(contributions, startDate, endDate),
    [contributions, startDate, endDate]
  );

  return (
    <div className="app-root">
      <header className="profile-header">
        <div className="profile-header-inner">
          <div className="ph-left">
            <button className="ph-menu-btn" aria-label="Menu">
              ☰
            </button>
            <div className="ph-logo">🐙</div>
            <span className="ph-username">{profile?.login || "shreeramk"}</span>
          </div>

          <div className="ph-right">
            <input className="ph-search" placeholder="Type / to search" />
            <button className="ph-icon-btn" aria-label="Team">
              👥
            </button>
            <button className="ph-icon-btn" aria-label="Add">
              +
            </button>
            <button className="ph-icon-btn" aria-label="Notifications">
              🔔
            </button>
            <div className="ph-avatar-circle">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.login}
                  className="ph-avatar-img"
                />
              ) : (
                "S"
              )}
            </div>
          </div>
        </div>

        <nav className="ph-tabs-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={
                "ph-tab-btn" +
                (activeTab === tab.id ? " ph-tab-btn--active" : "")
              }
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="ph-tab-icon">{tab.icon}</span>
              <span className="ph-tab-label">{tab.label}</span>
              {tab.count != null && (
                <span className="ph-tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="page-shell">
        <main className="page">
          <aside className="sidebar">
            {loadingProfile ? (
              <div className="card">Loading profile...</div>
            ) : profile ? (
              <>
                <div className="card sidebar-card">
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="avatar"
                  />
                  <h1 className="profile-name">{profile.name}</h1>
                  <p className="profile-username">{profile.login}</p>
                  <button className="btn-edit">Edit profile</button>

                  {profile.bio && <p className="profile-bio">{profile.bio}</p>}

                  <ul className="profile-meta">
                    {profile.company && (
                      <li>
                        <span className="meta-icon">🏢</span>
                        <span>{profile.company}</span>
                      </li>
                    )}
                    {profile.location && (
                      <li>
                        <span className="meta-icon">📍</span>
                        <span>{profile.location}</span>
                      </li>
                    )}
                    {profile.blog && (
                      <li>
                        <span className="meta-icon">🔗</span>
                        <a
                          href={
                            profile.blog.startsWith("http")
                              ? profile.blog
                              : `https://${profile.blog}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {profile.blog}
                        </a>
                      </li>
                    )}
                    {profile.email && (
                      <li>
                        <span className="meta-icon">✉️</span>
                        <a href={`mailto:${profile.email}`}>{profile.email}</a>
                      </li>
                    )}
                    <li>
                      <span className="meta-icon">🕒</span>
                      <span>Joined {formatJoinedDate(profile.created_at)}</span>
                    </li>
                    <li>
                      <span className="meta-icon">👥</span>
                      <span>
                        <strong>{profile.followers}</strong> followers ·{" "}
                        <strong>{profile.following}</strong> following
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="card small-card">
                  <h3 className="small-card-title">Achievements</h3>
                  <div className="badge-row">
                    <span className="badge-pill">🏅 YOLO</span>
                    <span className="badge-pill">🔥 100 days</span>
                    <span className="badge-pill">⭐ Starstruck</span>
                  </div>
                </div>

                <div className="card small-card">
                  <h3 className="small-card-title">Organizations</h3>
                  <div className="org-placeholder">No organizations</div>
                </div>
              </>
            ) : (
              <div className="card error">Failed to load profile</div>
            )}
          </aside>

          <section className="main-column">
            <section className="card">
              <div className="card-header">
                <h3>Popular repositories</h3>
                <button className="btn-new">Customize your pins</button>
              </div>
              <div className="repo-grid">
                {mockPopularRepos.map((repo) => (
                  <article key={repo.name} className="repo-card">
                    <div className="repo-card-header">
                      <h4 className="repo-name">{repo.name}</h4>
                      <span className="repo-public-pill">Public</span>
                    </div>
                    <p className="repo-desc">{repo.description}</p>
                    <div className="repo-meta-row">
                      <span className="repo-language-dot" />
                      <span className="repo-language">{repo.language}</span>
                      <span>★ {repo.stars}</span>
                      <span>⑂ {repo.forks}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="card contribution-section">
              <div className="card-header">
                <h3>{totalContributions} contributions in the last year</h3>
                <button className="contrib-settings">
                  Contribution settings ▾
                </button>
              </div>

              {contribInfo && <p className="info-text">{contribInfo}</p>}

              <div className="contrib-main">
                <div className="heatmap-wrapper">
                  {loadingContrib ? (
                    <p>Loading contributions...</p>
                  ) : (
                    <ReactECharts
                      option={heatmapOption}
                      style={{ width: "100%", height: 180 }}
                      className="contrib-chart"
                    />
                  )}

                  <div className="heatmap-legend-row">
                    <button className="legend-link">
                      Learn how we count contributions
                    </button>
                    <div className="legend-right">
                      <span className="legend-label">Less</span>
                      <span className="legend-box legend-box--0" />
                      <span className="legend-box legend-box--1" />
                      <span className="legend-box legend-box--2" />
                      <span className="legend-box legend-box--3" />
                      <span className="legend-box legend-box--4" />
                      <span className="legend-label">More</span>
                    </div>
                  </div>
                </div>

                <ul className="year-list">
                  {[
                    "2025",
                    "2024",
                    "2023",
                    "2022",
                    "2021",
                    "2020",
                    "2019",
                    "2018",
                    "2017",
                    "2016",
                    "2015",
                    "2014",
                    "2013",
                  ].map((year, idx) => (
                    <li
                      key={year}
                      className={
                        idx === 0 ? "year-item year-item--active" : "year-item"
                      }
                    >
                      {year}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="card activity-row">
              <div className="activity-column">
                <h3 className="activity-title">Activity overview</h3>
                <p className="activity-text">
                  Contributed to UptimeAI/uptime_webapp, UptimeAI/uptime_server
                  and many other repositories.
                </p>
              </div>
              <div className="activity-column activity-chart-placeholder">
                <h3 className="activity-title">Code review</h3>
                <div className="fake-radar">83% Commits · 17% PRs</div>
              </div>
            </section>

            <section className="card">
              <h3 className="activity-title">Contribution activity</h3>
              <p className="activity-text-muted">
                October 2025 · Created 56 commits in 11 repositories.
              </p>
              <button className="btn-show-more">Show more activity</button>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
