// scanner.js - Scanner GitHub Repos

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { BackendService } from './server.js';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SCAN_LANGUAGES = ['JavaScript', 'Python', 'Java', 'TypeScript', 'Go'];

class GitHubScanner {
  constructor() {
    this.backend = new BackendService();
    this.headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  async init() {
    await this.backend.init();
    console.log('✅ Scanner initialized');
  }

  async scanLanguage(language, perPage = 100) {
    console.log(`\n🔍 Scanning ${language} repos...`);
    
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=language:${language}+stars:>100&sort=stars&order=desc&per_page=${perPage}`,
        { headers: this.headers }
      );
      
      const data = await response.json();
      
      if (!data.items) {
        console.error('❌ No items returned');
        return [];
      }
      
      console.log(`📊 Found ${data.items.length} ${language} repos`);
      
      for (const repo of data.items) {
        await this.processRepo(repo);
        await this.sleep(500); // Rate limiting
      }
      
      return data.items;
    } catch (error) {
      console.error(`❌ Error scanning ${language}:`, error.message);
      return [];
    }
  }

  async processRepo(repo) {
    console.log(`📦 Processing: ${repo.full_name}`);
    
    try {
      // Récupérer README
      const readme = await this.fetchReadme(repo.full_name);
      
      if (!readme) {
        console.log(`⚠️  No README found for ${repo.full_name}`);
        return;
      }
      
      // Analyser avec IA (simplifié pour MVP)
      const analysis = this.analyzeRepo(repo, readme);
      
      // Sauvegarder dans DB
      const projectData = {
        github_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        language: repo.language,
        stars: repo.stargazers_count,
        topics: repo.topics || [],
        readme_content: readme,
        ai_analysis: analysis,
        utility_score: this.calculateUtilityScore(repo, readme, analysis),
        category: analysis.category
      };
      
      await this.backend.saveProject(projectData);
      console.log(`✅ Saved: ${repo.full_name}`);
      
    } catch (error) {
      console.error(`❌ Error processing ${repo.full_name}:`, error.message);
    }
  }

  async fetchReadme(fullName) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${fullName}/readme`,
        { headers: this.headers }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return content;
    } catch (error) {
      return null;
    }
  }

  analyzeRepo(repo, readme) {
    const readmeLower = readme.toLowerCase();
    const description = (repo.description || '').toLowerCase();
    
    // Détection catégorie
    let category = 'general';
    
    if (readmeLower.includes('auth') || readmeLower.includes('authentication')) {
      category = 'authentication';
    } else if (readmeLower.includes('api') || readmeLower.includes('rest')) {
      category = 'api';
    } else if (readmeLower.includes('database') || readmeLower.includes('orm')) {
      category = 'database';
    } else if (readmeLower.includes('ui') || readmeLower.includes('component')) {
      category = 'ui';
    } else if (readmeLower.includes('framework')) {
      category = 'framework';
    } else if (readmeLower.includes('cli') || readmeLower.includes('command')) {
      category = 'cli';
    } else if (readmeLower.includes('testing') || readmeLower.includes('test')) {
      category = 'testing';
    }
    
    // Extraction features
    const features = [];
    if (readmeLower.includes('typescript')) features.push('typescript');
    if (readmeLower.includes('async')) features.push('async');
    if (readmeLower.includes('security')) features.push('security');
    if (readmeLower.includes('performance')) features.push('performance');
    
    return {
      category,
      features,
      has_documentation: readme.length > 500,
      documentation_quality: this.assessDocQuality(readme),
      complexity: this.assessComplexity(readme),
      production_ready: readmeLower.includes('production') || repo.stargazers_count > 1000
    };
  }

  assessDocQuality(readme) {
    const length = readme.length;
    const hasInstall = readme.toLowerCase().includes('install');
    const hasUsage = readme.toLowerCase().includes('usage') || readme.toLowerCase().includes('example');
    
    if (length > 3000 && hasInstall && hasUsage) return 'excellent';
    if (length > 1500 && (hasInstall || hasUsage)) return 'good';
    if (length > 500) return 'basic';
    return 'poor';
  }

  assessComplexity(readme) {
    const length = readme.length;
    if (length > 5000) return 'high';
    if (length > 2000) return 'medium';
    return 'low';
  }

  calculateUtilityScore(repo, readme, analysis) {
    let score = 5.0;
    
    // Stars bonus
    if (repo.stargazers_count > 10000) score += 2;
    else if (repo.stargazers_count > 1000) score += 1;
    else if (repo.stargazers_count > 100) score += 0.5;
    
    // Documentation bonus
    if (analysis.documentation_quality === 'excellent') score += 1.5;
    else if (analysis.documentation_quality === 'good') score += 1;
    else if (analysis.documentation_quality === 'basic') score += 0.5;
    
    // Features bonus
    score += analysis.features.length * 0.2;
    
    // Production ready
    if (analysis.production_ready) score += 1;
    
    // Cap at 10
    return Math.min(score, 10);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scanAll() {
    console.log('🚀 Starting GitHub scan...');
    console.log(`📋 Languages: ${SCAN_LANGUAGES.join(', ')}`);
    
    for (const language of SCAN_LANGUAGES) {
      await this.scanLanguage(language, 100);
      await this.sleep(2000); // Pause entre langages
    }
    
    console.log('\n✅ Scan completed!');
  }
}

// Exécution
async function main() {
  const scanner = new GitHubScanner();
  await scanner.init();
  await scanner.scanAll();
  process.exit(0);
}

main();