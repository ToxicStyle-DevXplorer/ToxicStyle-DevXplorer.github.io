
  function githubPortfolio() {
    const USERNAME = 'ToxicStyle-DevXplorer';
    const CACHE_KEY = `gh_portfolio_${USERNAME}_v2`;
    const CACHE_TTL = 10 * 60 * 1000; // 10 минут

    return {
      username: USERNAME,
      loading: true,
      copied: false,
      contactCopied: false,
      darkMode: false,
      mobileMenuOpen: false,
      activeTab: 'profile',
      searchQuery: '',
      selectedLang: 'All',
      sortBy: 'updated',
      mouseX: 0,
      mouseY: 0,

      profile: {
        login: USERNAME,
        avatar_url: `https://github.com/${USERNAME}.png`,
        html_url: `https://github.com/${USERNAME}`,
        bio: '',
        location: 'Tashkent, UZ',
        public_repos: 0,
        followers: 0,
      },
      repos: [],
      events: [],

      
        async init() {
        // Восстанавливаем тему из localStorage
        const savedTheme = localStorage.getItem('aurora_theme');
        this.darkMode = savedTheme === 'dark';
        document.documentElement.classList.toggle('dark', this.darkMode);

        this.refreshIcons();

        ['searchQuery', 'selectedLang', 'sortBy', 'activeTab'].forEach(prop => {
          this.$watch(prop, () => this.refreshIcons());
        });

        await this.fetchGitHubData();
        this.refreshIcons();
      },

      toggleTheme(event) {
        const nextMode = !this.darkMode;

        const applyTheme = () => {
          this.darkMode = nextMode;
          localStorage.setItem('aurora_theme', this.darkMode ? 'dark' : 'light');
          document.documentElement.classList.toggle('dark', this.darkMode);
          this.refreshIcons();
        };

        if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          applyTheme();
          return;
        }

        const x = event?.clientX ?? window.innerWidth / 2;
        const y = event?.clientY ?? 0;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
          applyTheme();
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
            },
            {
              duration: 550,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        });
      },

      refreshIcons() {
        this.$nextTick(() => {
          if (window.lucide) lucide.createIcons();
        });
      },

      handleMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      },

      copyCloneCmd() {
        navigator.clipboard.writeText(`gh api users/${this.username}`);
        this.copied = true;
        this.refreshIcons();
        setTimeout(() => {
          this.copied = false;
          this.refreshIcons();
        }, 2000);
      },

      copyContact(text) {
        navigator.clipboard.writeText(text);
        this.contactCopied = true;
        this.refreshIcons();
        setTimeout(() => {
          this.contactCopied = false;
          this.refreshIcons();
        }, 2000);
      },

      async fetchGitHubData() {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_TTL) {
              this.profile = parsed.profile;
              this.repos = parsed.repos;
              this.events = parsed.events || [];
              this.loading = false;
              return;
            }
          }

          const [userRes, reposRes, eventsRes] = await Promise.all([
            fetch(`https://api.github.com/users/${this.username}`),
            fetch(`https://api.github.com/users/${this.username}/repos?sort=updated&per_page=100`),
            fetch(`https://api.github.com/users/${this.username}/events/public?per_page=25`)
          ]);

          if (userRes.ok) {
            this.profile = await userRes.json();
          }

          if (reposRes.ok) {
            const rawRepos = await reposRes.json();
            this.repos = rawRepos.filter(r => !r.fork);
          }

          if (eventsRes.ok) {
            this.events = await eventsRes.json();
          }

          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            profile: this.profile,
            repos: this.repos,
            events: this.events
          }));
        } catch (err) {
          console.warn('GitHub API fallback active:', err);
        } finally {
          this.loading = false;
        }
      },

      get totalStars() {
        return this.repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
      },

      get availableLanguages() {
        const langs = new Set(this.repos.map(r => r.language).filter(Boolean));
        return Array.from(langs);
      },

      get filteredRepos() {
        const q = this.searchQuery.toLowerCase().trim();

        return this.repos
          .filter(repo => {
            const matchesLang = this.selectedLang === 'All' || repo.language === this.selectedLang;
            const matchesQuery = !q ||
              repo.name.toLowerCase().includes(q) ||
              (repo.description && repo.description.toLowerCase().includes(q));
            return matchesLang && matchesQuery;
          })
          .sort((a, b) => {
            if (this.sortBy === 'stars') {
              return b.stargazers_count - a.stargazers_count;
            }
            return new Date(b.updated_at) - new Date(a.updated_at);
          });
      },

      get recentEvents() {
        if (this.events && this.events.length > 0) {
          return this.events.slice(0, 6).map(ev => {
            const repoShort = ev.repo?.name?.replace(`${this.username}/`, '') || 'repository';
            const branch = ev.payload?.ref ? ev.payload.ref.replace('refs/heads/', '') : 'main';
            let action = 'updated repository';
            let icon = 'git-commit-horizontal';

            switch (ev.type) {
              case 'PushEvent': {
                const count = ev.payload?.commits?.length || 1;
                action = `pushed ${count} commit${count > 1 ? 's' : ''} to ${branch}`;
                icon = 'git-commit-horizontal';
                break;
              }
              case 'CreateEvent':
                action = `created ${ev.payload?.ref_type || 'branch'} ${ev.payload?.ref || ''}`.trim();
                icon = 'git-branch';
                break;
              case 'WatchEvent':
                action = 'starred repository';
                icon = 'star';
                break;
              case 'ForkEvent':
                action = 'forked repository';
                icon = 'git-fork';
                break;
              case 'PullRequestEvent':
                action = `${ev.payload?.action || 'opened'} pull request #${ev.payload?.number || ''}`;
                icon = 'git-pull-request';
                break;
              case 'ReleaseEvent':
                action = `published release ${ev.payload?.release?.tag_name || ''}`;
                icon = 'sparkles';
                break;
            }

            return {
              id: ev.id,
              repoName: repoShort,
              action,
              icon,
              url: `https://github.com/${ev.repo?.name || this.username}`,
              timeAgo: this.timeAgo(ev.created_at)
            };
          });
        }

        // Фолбэк на последние обновлённые репозитории, если лента событий пуста
        return this.repos.slice(0, 5).map(repo => ({
          id: repo.id,
          repoName: repo.name,
          action: `pushed updates to ${repo.default_branch || 'main'}`,
          icon: 'git-commit-horizontal',
          url: repo.html_url,
          timeAgo: this.timeAgo(repo.pushed_at || repo.updated_at)
        }));
      },

      get contributionCells() {
        const totalDays = 168; // 24 недели × 7 дней
        const countsByDay = {};

        (this.events || []).forEach(ev => {
          const key = ev.created_at?.slice(0, 10);
          if (key) countsByDay[key] = (countsByDay[key] || 0) + 2;
        });

        (this.repos || []).forEach(repo => {
          [repo.pushed_at, repo.created_at, repo.updated_at].forEach(ts => {
            const key = ts?.slice(0, 10);
            if (key) countsByDay[key] = (countsByDay[key] || 0) + 1;
          });
        });

        const cells = [];
        const now = new Date();
        for (let i = totalDays - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const iso = d.toISOString().slice(0, 10);
          const count = countsByDay[iso] || 0;

          const level = count >= 4 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0;

          cells.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count,
            level
          });
        }
        return cells;
      },

      timeAgo(isoString) {
        if (!isoString) return '';
        const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return this.formatDate(isoString);
      },

      formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    };
  }
