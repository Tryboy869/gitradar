// scanner.js - Backend Service GitRadar
// GitHub Scanner + IA Analysis + Database Management
// CEO: Abdoul Anzize DAOUDA - Nexus Studio

import { createClient } from '@libsql/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ========== CONFIGURATION ==========
const TOP_5_LANGUAGES = ['Python', 'JavaScript', 'TypeScript', 'Go', 'Rust'];
const GITHUB_API = 'https://api.github.com';
const SCAN_BATCH_SIZE = 100; // Repos par batch
const SCAN_INTERVAL = 12 * 60 * 60 * 1000; // 12 heures

export class GitRadarScanner {
  constructor() {
    this.usersDb = null;
    this.reposDb = null;
    this.githubToken = process.env.GITHUB_TOKEN;
    this.jwtSecret = process.env.JWT_SECRET || 'nexus-studio-gitradar-secret-2025';
    this.scanInProgress = false;
  }

  // ========== INITIALISATION ==========
  async init() {
    console.log('✅ [SCANNER] Initializing databases...');
    
    // DB Utilisateurs
    this.usersDb = createClient({
      url: process.env.TURSO_USERS_URL,
      authToken: process.env.TURSO_USERS_TOKEN
    });

    // DB Repos
    this.reposDb = createClient({
      url: process.env.TURSO_REPOS_URL,
      authToken: process.env.TURSO_REPOS_TOKEN
    });

    // Créer tables si nécessaire
    await this.createTables();
    
    // Démarrer scan automatique
    this.startAutoScan();
    
    console.log('✅ [SCANNER] Ready');
  }

  async createTables() {
    // Table users
    await this.usersDb.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        preferences TEXT DEFAULT '{}',
        profile_complete INTEGER DEFAULT 0
      )
    `);

    // Table repos
    await this.reposDb.execute(`
      CREATE TABLE IF NOT EXISTS repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_id INTEGER UNIQUE NOT NULL,
        full_name TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        language TEXT NOT NULL,
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        created_at DATETIME,
        updated_at DATETIME,
        homepage TEXT,
        readme_content TEXT,
        has_docs_folder INTEGER DEFAULT 0,
        ai_analysis TEXT NOT NULL,
        scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        scan_version TEXT DEFAULT '1.0',
        needs_rescan INTEGER DEFAULT 0
      )
    `);

    console.log('✅ [SCANNER] Tables created/verified');
  }

  // ========== AUTHENTIFICATION ==========
  async registerUser(body) {
    const { username, email, password } = body;

    if (!username || !email || !password) {
      throw new Error('Missing required fields');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    try {
      await this.usersDb.execute({
        sql: `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
        args: [username, email, password_hash]
      });

      console.log(`✅ [AUTH] User registered: ${username}`);

      // Générer JWT
      const token = jwt.sign({ username, email }, this.jwtSecret, { expiresIn: '7d' });

      return {
        success: true,
        message: 'User registered successfully',
        token,
        user: { username, email }
      };
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  async loginUser(body) {
    const { email, password } = body;

    if (!email || !password) {
      throw new Error('Email and password required');
    }

    const result = await this.usersDb.execute({
      sql: `SELECT * FROM users WHERE email = ?`,
      args: [email]
    });

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { username: user.username, email: user.email },
      this.jwtSecret,
      { expiresIn: '7d' }
    );

    console.log(`✅ [AUTH] User logged in: ${user.username}`);

    return {
      success: true,
      token,
      user: {
        username: user.username,
        email: user.email,
        preferences: JSON.parse(user.preferences || '{}')
      }
    };
  }

  // ========== GITHUB SCANNING ==========
  async scanGitHubRepos(language, limit = SCAN_BATCH_SIZE) {
    console.log(`🔍 [SCANNER] Scanning ${language} repos (limit: ${limit})`);

    try {
      const response = await fetch(
        `${GITHUB_API}/search/repositories?q=language:${language}+stars:>50+archived:false&sort=stars&per_page=${limit}`,
        {
          headers: {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ [SCANNER] Found ${data.items.length} ${language} repos`);

      return data.items;
    } catch (error) {
      console.error(`❌ [SCANNER] Error scanning ${language}:`, error.message);
      return [];
    }
  }

  async fetchReadme(fullName) {
    try {
      const response = await fetch(
        `${GITHUB_API}/repos/${fullName}/readme`,
        {
          headers: {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3.raw'
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const readme = await response.text();
      return readme;
    } catch (error) {
      console.error(`❌ [SCANNER] Error fetching README for ${fullName}`);
      return null;
    }
  }

  async analyzeRepoWithAI(repo, readme) {
    // Analyse IA du README pour extraire métadonnées intelligentes
    
    const analysis = {
      category: this.detectCategory(readme, repo),
      use_case: this.extractUseCase(readme),
      problem_solved: this.extractProblem(readme),
      target_audience: this.detectAudience(readme, repo.language),
      tech_stack: this.extractTechStack(readme, repo),
      utility_score: this.calculateUtilityScore(repo, readme),
      complexity: this.estimateComplexity(readme),
      production_ready: this.isProductionReady(readme, repo),
      alternatives: [],
      complements: [],
      best_for: this.extractBestFor(readme)
    };

    return analysis;
  }

  detectCategory(readme, repo) {
    const text = (readme + ' ' + repo.description || '').toLowerCase();
    
    const categories = {
      'authentication': ['auth', 'login', 'jwt', 'oauth', 'passport', 'session'],
      'database': ['database', 'sql', 'nosql', 'orm', 'query', 'postgres', 'mongo'],
      'api': ['api', 'rest', 'graphql', 'endpoint', 'http'],
      'ui-component': ['component', 'ui', 'widget', 'button', 'input', 'form'],
      'framework': ['framework', 'scaffold', 'boilerplate', 'template'],
      'testing': ['test', 'testing', 'jest', 'mocha', 'cypress'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'deploy', 'infrastructure'],
      'ai-ml': ['ai', 'machine learning', 'neural', 'model', 'training'],
      'data-science': ['data', 'analysis', 'visualization', 'pandas', 'numpy'],
      'cli-tool': ['cli', 'command', 'terminal', 'console'],
      'web-framework': ['web', 'server', 'http', 'express', 'fastapi'],
      'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  extractUseCase(readme) {
    // Extrait le cas d'usage principal du README
    const lines = readme.split('\n').slice(0, 20);
    for (const line of lines) {
      if (line.toLowerCase().includes('use case') || 
          line.toLowerCase().includes('perfect for') ||
          line.toLowerCase().includes('built for')) {
        return line.replace(/[#*]/g, '').trim().substring(0, 200);
      }
    }
    return 'General purpose library';
  }

  extractProblem(readme) {
    const text = readme.toLowerCase();
    const problemPhrases = ['solves', 'avoid', 'eliminates', 'simplifies', 'makes easy'];
    
    for (const phrase of problemPhrases) {
      const index = text.indexOf(phrase);
      if (index !== -1) {
        return text.substring(index, index + 150).trim();
      }
    }
    
    return 'Provides functionality for development';
  }

  detectAudience(readme, language) {
    const text = readme.toLowerCase();
    
    if (text.includes('beginner') || text.includes('getting started')) {
      return 'beginners';
    }
    if (text.includes('enterprise') || text.includes('production')) {
      return 'enterprise';
    }
    
    return `${language.toLowerCase()}_developers`;
  }

  extractTechStack(readme, repo) {
    const stack = [repo.language.toLowerCase()];
    const text = readme.toLowerCase();
    
    const techs = {
      'react': 'react',
      'vue': 'vue',
      'angular': 'angular',
      'node': 'nodejs',
      'express': 'express',
      'fastapi': 'fastapi',
      'django': 'django',
      'flask': 'flask',
      'typescript': 'typescript',
      'docker': 'docker',
      'kubernetes': 'kubernetes',
      'postgresql': 'postgresql',
      'mongodb': 'mongodb',
      'redis': 'redis'
    };

    for (const [keyword, tech] of Object.entries(techs)) {
      if (text.includes(keyword) && !stack.includes(tech)) {
        stack.push(tech);
      }
    }

    return stack;
  }

  calculateUtilityScore(repo, readme) {
    let score = 5.0;

    // Stars
    if (repo.stargazers_count > 10000) score += 1.5;
    else if (repo.stargazers_count > 1000) score += 1.0;
    else if (repo.stargazers_count > 100) score += 0.5;

    // Documentation quality
    if (readme && readme.length > 1000) score += 1.0;
    if (readme && readme.includes('## Installation')) score += 0.5;
    if (readme && readme.includes('## Usage')) score += 0.5;
    if (readme && readme.includes('## Examples')) score += 0.5;

    // Activity
    const lastUpdate = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) score += 0.5;

    // Issues/PRs (signe de communauté active)
    if (repo.open_issues_count > 0 && repo.open_issues_count < 100) score += 0.5;

    return Math.min(score, 10).toFixed(1);
  }

  estimateComplexity(readme) {
    const length = readme ? readme.length : 0;
    
    if (length > 5000) return 'advanced';
    if (length > 2000) return 'intermediate';
    return 'beginner';
  }

  isProductionReady(readme, repo) {
    const text = (readme || '').toLowerCase();
    const description = (repo.description || '').toLowerCase();
    
    const readyIndicators = ['production', 'stable', 'v1.', 'battle-tested'];
    const notReadyIndicators = ['beta', 'alpha', 'experimental', 'wip', 'work in progress'];
    
    for (const indicator of notReadyIndicators) {
      if (text.includes(indicator) || description.includes(indicator)) {
        return false;
      }
    }
    
    for (const indicator of readyIndicators) {
      if (text.includes(indicator) || description.includes(indicator)) {
        return true;
      }
    }
    
    // Heuristique: beaucoup de stars + pas d'update récente = stable
    if (repo.stargazers_count > 1000) {
      const daysSinceUpdate = (Date.now() - new Date(repo.updated_at)) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 90) return true; // Stable, pas besoin d'updates
    }
    
    return repo.stargazers_count > 500;
  }

  extractBestFor(readme) {
    const text = readme.toLowerCase();
    
    if (text.includes('lightweight') || text.includes('minimal')) return 'lightweight_projects';
    if (text.includes('enterprise') || text.includes('scale')) return 'enterprise_applications';
    if (text.includes('quick') || text.includes('rapid')) return 'rapid_prototyping';
    
    return 'general_development';
  }

  // Suite dans Part 2...
}

    // scanner.js - Part 2/2
// Continuer la classe GitRadarScanner...

// Ajouter ces méthodes à la classe GitRadarScanner (après extractBestFor):

  async saveRepo(repo, readme, analysis) {
    try {
      await this.reposDb.execute({
        sql: `INSERT OR REPLACE INTO repos 
          (github_id, full_name, name, description, language, stars, forks, 
           created_at, updated_at, homepage, readme_content, has_docs_folder, 
           ai_analysis, scan_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          repo.id,
          repo.full_name,
          repo.name,
          repo.description || '',
          repo.language,
          repo.stargazers_count,
          repo.forks_count,
          repo.created_at,
          repo.updated_at,
          repo.homepage || '',
          readme || '',
          readme ? (readme.includes('docs/') ? 1 : 0) : 0,
          JSON.stringify(analysis)
        ]
      });

      console.log(`✅ [SCANNER] Saved repo: ${repo.full_name}`);
    } catch (error) {
      console.error(`❌ [SCANNER] Error saving ${repo.full_name}:`, error.message);
    }
  }

  async scanLanguage(language) {
    console.log(`🚀 [SCANNER] Starting scan for ${language}`);
    
    const repos = await this.scanGitHubRepos(language, SCAN_BATCH_SIZE);
    let processed = 0;

    for (const repo of repos) {
      try {
        // Vérifier si déjà scanné récemment
        const existing = await this.reposDb.execute({
          sql: `SELECT scan_date FROM repos WHERE github_id = ?`,
          args: [repo.id]
        });

        if (existing.rows.length > 0) {
          const lastScan = new Date(existing.rows[0].scan_date);
          const hoursSinceScan = (Date.now() - lastScan) / (1000 * 60 * 60);
          
          if (hoursSinceScan < 12) {
            console.log(`⏭️  [SCANNER] Skipping ${repo.full_name} (recently scanned)`);
            continue;
          }
        }

        // Fetch README
        const readme = await this.fetchReadme(repo.full_name);
        
        if (!readme || readme.length < 100) {
          console.log(`⏭️  [SCANNER] Skipping ${repo.full_name} (no README)`);
          continue;
        }

        // Analyse IA
        const analysis = await this.analyzeRepoWithAI(repo, readme);

        // Sauvegarder
        await this.saveRepo(repo, readme, analysis);
        processed++;

        // Rate limiting: attendre 500ms entre chaque repo
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ [SCANNER] Error processing ${repo.full_name}:`, error.message);
      }
    }

    console.log(`✅ [SCANNER] Completed ${language}: ${processed}/${repos.length} repos processed`);
    return processed;
  }

  startAutoScan() {
    console.log('🔄 [SCANNER] Starting auto-scan (every 12h)');

    // Scan initial
    this.performFullScan();

    // Scan toutes les 12h
    setInterval(() => {
      this.performFullScan();
    }, SCAN_INTERVAL);
  }

  async performFullScan() {
    if (this.scanInProgress) {
      console.log('⏸️  [SCANNER] Scan already in progress, skipping...');
      return;
    }

    this.scanInProgress = true;
    console.log('🚀 [SCANNER] Starting full scan of TOP 5 languages');

    try {
      for (const language of TOP_5_LANGUAGES) {
        await this.scanLanguage(language);
        // Pause entre chaque langage pour éviter rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ [SCANNER] Full scan completed');
    } catch (error) {
      console.error('❌ [SCANNER] Full scan error:', error);
    } finally {
      this.scanInProgress = false;
    }
  }

  // ========== API ENDPOINTS ==========

  async searchRepos(query) {
    const { 
      search = '', 
      language = '', 
      category = '', 
      minStars = 0,
      sortBy = 'utility_score',
      limit = 50 
    } = query;

    let sql = `SELECT * FROM repos WHERE 1=1`;
    const args = [];

    if (search) {
      sql += ` AND (name LIKE ? OR description LIKE ?)`;
      args.push(`%${search}%`, `%${search}%`);
    }

    if (language) {
      sql += ` AND language = ?`;
      args.push(language);
    }

    if (category) {
      sql += ` AND json_extract(ai_analysis, '$.category') = ?`;
      args.push(category);
    }

    if (minStars > 0) {
      sql += ` AND stars >= ?`;
      args.push(minStars);
    }

    // Tri
    if (sortBy === 'utility_score') {
      sql += ` ORDER BY CAST(json_extract(ai_analysis, '$.utility_score') AS REAL) DESC`;
    } else if (sortBy === 'stars') {
      sql += ` ORDER BY stars DESC`;
    } else if (sortBy === 'recent') {
      sql += ` ORDER BY updated_at DESC`;
    }

    sql += ` LIMIT ?`;
    args.push(limit);

    const result = await this.reposDb.execute({ sql, args });

    const repos = result.rows.map(row => ({
      ...row,
      ai_analysis: JSON.parse(row.ai_analysis)
    }));

    return {
      success: true,
      count: repos.length,
      repos
    };
  }

  async getRepoDetails(repoId) {
    const result = await this.reposDb.execute({
      sql: `SELECT * FROM repos WHERE id = ?`,
      args: [repoId]
    });

    if (result.rows.length === 0) {
      throw new Error('Repo not found');
    }

    const repo = result.rows[0];
    repo.ai_analysis = JSON.parse(repo.ai_analysis);

    return {
      success: true,
      repo
    };
  }

  async getReposByLanguage(language) {
    const result = await this.reposDb.execute({
      sql: `SELECT * FROM repos WHERE language = ? 
            ORDER BY CAST(json_extract(ai_analysis, '$.utility_score') AS REAL) DESC 
            LIMIT 100`,
      args: [language]
    });

    const repos = result.rows.map(row => ({
      ...row,
      ai_analysis: JSON.parse(row.ai_analysis)
    }));

    return {
      success: true,
      language,
      count: repos.length,
      repos
    };
  }

  async getRecommendations(body, headers) {
    const { projectType, features, preferences } = body;
    
    // Extraire user depuis JWT
    const token = headers['authorization']?.replace('Bearer ', '');
    let userPreferences = preferences || {};

    if (token) {
      try {
        const decoded = jwt.verify(token, this.jwtSecret);
        const userResult = await this.usersDb.execute({
          sql: `SELECT preferences FROM users WHERE email = ?`,
          args: [decoded.email]
        });
        
        if (userResult.rows.length > 0) {
          userPreferences = JSON.parse(userResult.rows[0].preferences || '{}');
        }
      } catch (error) {
        // Token invalide, continuer sans préférences
      }
    }

    // Recherche intelligente basée sur projectType et features
    const recommendations = [];

    for (const feature of features || []) {
      const result = await this.reposDb.execute({
        sql: `SELECT * FROM repos 
              WHERE json_extract(ai_analysis, '$.category') LIKE ?
              ORDER BY CAST(json_extract(ai_analysis, '$.utility_score') AS REAL) DESC
              LIMIT 3`,
        args: [`%${feature}%`]
      });

      recommendations.push(...result.rows.map(row => ({
        ...row,
        ai_analysis: JSON.parse(row.ai_analysis),
        reason: `Recommended for ${feature}`
      })));
    }

    return {
      success: true,
      projectType,
      recommendations: recommendations.slice(0, 10)
    };
  }

  async buildStack(body) {
    const { projectDescription, constraints } = body;

    // Analyse simplifiée: extraire mots-clés du projectDescription
    const keywords = projectDescription.toLowerCase().match(/\w+/g) || [];
    
    const stack = {
      frontend: [],
      backend: [],
      database: [],
      tools: []
    };

    // Rechercher repos pertinents pour chaque catégorie
    const categories = ['framework', 'database', 'api', 'authentication'];

    for (const category of categories) {
      const result = await this.reposDb.execute({
        sql: `SELECT * FROM repos 
              WHERE json_extract(ai_analysis, '$.category') = ?
              ORDER BY CAST(json_extract(ai_analysis, '$.utility_score') AS REAL) DESC
              LIMIT 3`,
        args: [category]
      });

      result.rows.forEach(row => {
        const repo = {
          ...row,
          ai_analysis: JSON.parse(row.ai_analysis)
        };

        if (category === 'framework') {
          if (repo.language === 'JavaScript' || repo.language === 'TypeScript') {
            stack.frontend.push(repo);
          } else {
            stack.backend.push(repo);
          }
        } else if (category === 'database') {
          stack.database.push(repo);
        } else {
          stack.tools.push(repo);
        }
      });
    }

    return {
      success: true,
      projectDescription,
      recommendedStack: stack
    };
  }

  async getCollections(query) {
    const { type = 'popular' } = query;

    let collections = [];

    if (type === 'popular') {
      collections = await this.getPopularCollections();
    } else if (type === 'trending') {
      collections = await this.getTrendingCollections();
    } else if (type === 'hidden-gems') {
      collections = await this.getHiddenGems();
    }

    return {
      success: true,
      type,
      collections
    };
  }

  async getPopularCollections() {
    const result = await this.reposDb.execute({
      sql: `SELECT language, COUNT(*) as count, AVG(stars) as avg_stars
            FROM repos
            GROUP BY language
            ORDER BY count DESC
            LIMIT 5`
    });

    return result.rows.map(row => ({
      name: `Popular ${row.language} Projects`,
      language: row.language,
      count: row.count,
      avgStars: Math.round(row.avg_stars)
    }));
  }

  async getTrendingCollections() {
    const result = await this.reposDb.execute({
      sql: `SELECT * FROM repos
            WHERE updated_at > datetime('now', '-30 days')
            ORDER BY stars DESC
            LIMIT 20`
    });

    return [{
      name: 'Trending This Month',
      repos: result.rows.map(row => ({
        ...row,
        ai_analysis: JSON.parse(row.ai_analysis)
      }))
    }];
  }

  async getHiddenGems() {
    const result = await this.reposDb.execute({
      sql: `SELECT * FROM repos
            WHERE stars >= 100 AND stars <= 1000
            AND CAST(json_extract(ai_analysis, '$.utility_score') AS REAL) >= 8.0
            ORDER BY CAST(json_extract(ai_analysis, '$.utility_score') AS REAL) DESC
            LIMIT 20`
    });

    return [{
      name: 'Hidden Gems',
      description: 'High utility, underrated projects',
      repos: result.rows.map(row => ({
        ...row,
        ai_analysis: JSON.parse(row.ai_analysis)
      }))
    }];
  }

  async getTrending(query) {
    return this.getTrendingCollections();
  }

  async getUserProfile(headers) {
    const token = headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Unauthorized');
    }

    const decoded = jwt.verify(token, this.jwtSecret);
    
    const result = await this.usersDb.execute({
      sql: `SELECT username, email, preferences, created_at FROM users WHERE email = ?`,
      args: [decoded.email]
    });

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    return {
      success: true,
      user: {
        ...user,
        preferences: JSON.parse(user.preferences || '{}')
      }
    };
  }

  async updateProfile(body, headers) {
    const token = headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Unauthorized');
    }

    const decoded = jwt.verify(token, this.jwtSecret);
    const { preferences } = body;

    await this.usersDb.execute({
      sql: `UPDATE users SET preferences = ?, profile_complete = 1 WHERE email = ?`,
      args: [JSON.stringify(preferences), decoded.email]
    });

    return {
      success: true,
      message: 'Profile updated'
    };
  }

  async getStats() {
    const reposCount = await this.reposDb.execute(`SELECT COUNT(*) as count FROM repos`);
    const usersCount = await this.usersDb.execute(`SELECT COUNT(*) as count FROM users`);
    
    const languageStats = await this.reposDb.execute({
      sql: `SELECT language, COUNT(*) as count FROM repos GROUP BY language ORDER BY count DESC LIMIT 10`
    });

    return {
      success: true,
      stats: {
        totalRepos: reposCount.rows[0].count,
        totalUsers: usersCount.rows[0].count,
        languages: languageStats.rows,
        lastScan: new Date().toISOString(),
        scanInProgress: this.scanInProgress
      }
    };
  }

  async healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'ok',
      services: {}
    };

    try {
      await this.usersDb.execute('SELECT 1');
      checks.services.usersDb = 'connected';
    } catch (error) {
      checks.services.usersDb = 'offline';
      checks.status = 'degraded';
    }

    try {
      await this.reposDb.execute('SELECT 1');
      checks.services.reposDb = 'connected';
    } catch (error) {
      checks.services.reposDb = 'offline';
      checks.status = 'degraded';
    }

    checks.services.scanner = this.scanInProgress ? 'scanning' : 'idle';

    return checks;
  }
}