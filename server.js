// server.js - Backend Service avec Turso DB (NEXUS AXION 4.1)

import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export class BackendService {
  constructor() {
    console.log('🔧 [BACKEND] Constructing BackendService...');
    
    // Connexion DB Utilisateurs (Turso 1)
    this.dbUsers = createClient({
      url: process.env.TURSO_DB_URL_USERS,
      authToken: process.env.TURSO_DB_TOKEN_USERS
    });
    
    // Connexion DB Projets (Turso 2)
    this.dbProjects = createClient({
      url: process.env.TURSO_DB_URL_PROJECTS,
      authToken: process.env.TURSO_DB_TOKEN_PROJECTS
    });
    
    this.jwtSecret = process.env.JWT_SECRET;
    
    console.log('✅ [BACKEND] Database clients created');
  }

  async init() {
    console.log('🔧 [BACKEND] Initializing databases...');
    
    try {
      // ========== ÉTAPE 1 : SUPPRIMER LES ANCIENNES TABLES ==========
      console.log('🗑️ [BACKEND] Dropping old tables if they exist...');
      
      try {
        await this.dbUsers.execute('DROP TABLE IF EXISTS users');
        console.log('✅ [BACKEND] Old users table dropped');
      } catch (error) {
        console.log('⚠️ [BACKEND] No old users table to drop:', error.message);
      }
      
      try {
        await this.dbProjects.execute('DROP TABLE IF EXISTS projects');
        console.log('✅ [BACKEND] Old projects table dropped');
      } catch (error) {
        console.log('⚠️ [BACKEND] No old projects table to drop:', error.message);
      }
      
      // ========== ÉTAPE 2 : CRÉER TABLES PROPRES ==========
      console.log('📋 [BACKEND] Creating fresh tables...');
      
      // Créer table utilisateurs
      await this.dbUsers.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ [BACKEND] Users table created successfully');
      
      // Créer table projets GitHub
      await this.dbProjects.execute(`
        CREATE TABLE projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          github_id INTEGER UNIQUE NOT NULL,
          name TEXT NOT NULL,
          full_name TEXT NOT NULL,
          description TEXT,
          language TEXT,
          stars INTEGER DEFAULT 0,
          topics TEXT,
          readme_content TEXT,
          ai_analysis TEXT,
          utility_score REAL DEFAULT 0,
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ [BACKEND] Projects table created successfully');
      
      // ========== ÉTAPE 3 : CRÉER INDEX ==========
      console.log('📊 [BACKEND] Creating indexes...');
      
      await this.dbProjects.execute(`
        CREATE INDEX IF NOT EXISTS idx_language ON projects(language)
      `);
      
      await this.dbProjects.execute(`
        CREATE INDEX IF NOT EXISTS idx_category ON projects(category)
      `);
      
      await this.dbProjects.execute(`
        CREATE INDEX IF NOT EXISTS idx_utility ON projects(utility_score)
      `);
      
      console.log('✅ [BACKEND] Indexes created successfully');
      
      // ========== ÉTAPE 4 : VÉRIFIER SCHÉMAS ==========
      console.log('🔍 [BACKEND] Verifying table schemas...');
      
      const usersSchema = await this.dbUsers.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
      console.log('📋 [BACKEND] Users table schema:', usersSchema.rows[0]?.sql);
      
      const projectsSchema = await this.dbProjects.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'");
      console.log('📋 [BACKEND] Projects table schema:', projectsSchema.rows[0]?.sql);
      
      console.log('✅ [BACKEND] Databases initialized successfully!');
    } catch (error) {
      console.error('❌ [BACKEND] Database initialization failed:', error);
      throw error;
    }
  }

  // ========== AUTHENTIFICATION ==========
  
  async signup(email, username, password) {
    console.log('[BACKEND] signup:', email, username);
    
    try {
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('[BACKEND] Password hashed successfully');
      
      const result = await this.dbUsers.execute({
        sql: 'INSERT INTO users (email, username, password) VALUES (?, ?, ?)',
        args: [email, username, hashedPassword]
      });
      
      console.log('[BACKEND] User inserted, ID:', result.lastInsertRowid);
      
      const userId = result.lastInsertRowid;
      
      // Générer JWT token
      const token = jwt.sign(
        { userId, email, username },
        this.jwtSecret,
        { expiresIn: '30d' }
      );
      
      console.log('[BACKEND] JWT token generated');
      
      return {
        success: true,
        user: { id: userId, email, username },
        token
      };
    } catch (error) {
      console.error('[BACKEND] Signup error:', error);
      
      if (error.message.includes('UNIQUE constraint failed')) {
        return {
          success: false,
          message: 'Email ou nom d\'utilisateur déjà utilisé'
        };
      }
      throw error;
    }
  }

  async login(email, password) {
    console.log('[BACKEND] login:', email);
    
    try {
      const result = await this.dbUsers.execute({
        sql: 'SELECT * FROM users WHERE email = ?',
        args: [email]
      });
      
      console.log('[BACKEND] Query result:', result.rows.length, 'rows');
      
      if (result.rows.length === 0) {
        console.log('[BACKEND] User not found');
        return { success: false, message: 'Email ou mot de passe incorrect' };
      }
      
      const user = result.rows[0];
      console.log('[BACKEND] User found:', user.username);
      
      // Vérifier mot de passe
      const validPassword = await bcrypt.compare(password, user.password);
      console.log('[BACKEND] Password valid:', validPassword);
      
      if (!validPassword) {
        return { success: false, message: 'Email ou mot de passe incorrect' };
      }
      
      // Générer JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        this.jwtSecret,
        { expiresIn: '30d' }
      );
      
      console.log('[BACKEND] Login successful');
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username
        },
        token
      };
    } catch (error) {
      console.error('[BACKEND] Login error:', error);
      throw error;
    }
  }

  async getProfile(token) {
    console.log('[BACKEND] getProfile');
    
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      console.log('[BACKEND] Token decoded:', decoded.userId);
      
      const result = await this.dbUsers.execute({
        sql: 'SELECT id, email, username, created_at FROM users WHERE id = ?',
        args: [decoded.userId]
      });
      
      if (result.rows.length === 0) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }
      
      return {
        success: true,
        user: result.rows[0]
      };
    } catch (error) {
      console.error('[BACKEND] Get profile error:', error);
      return { success: false, message: 'Token invalide' };
    }
  }

  // ========== PROJETS GITHUB ==========
  
  async getProjects(filters = {}) {
    console.log('[BACKEND] getProjects:', filters);
    
    try {
      let sql = 'SELECT * FROM projects WHERE 1=1';
      const args = [];
      
      if (filters.language) {
        sql += ' AND language = ?';
        args.push(filters.language);
      }
      
      if (filters.category) {
        sql += ' AND category = ?';
        args.push(filters.category);
      }
      
      if (filters.search) {
        sql += ' AND (name LIKE ? OR description LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        args.push(searchTerm, searchTerm);
      }
      
      sql += ' ORDER BY utility_score DESC';
      
      const limit = filters.limit || 50;
      sql += ' LIMIT ?';
      args.push(limit);
      
      console.log('[BACKEND] Executing query:', sql);
      console.log('[BACKEND] With args:', args);
      
      const result = await this.dbProjects.execute({ sql, args });
      
      console.log('[BACKEND] Found', result.rows.length, 'projects');
      
      return {
        success: true,
        projects: result.rows.map(row => ({
          ...row,
          topics: row.topics ? JSON.parse(row.topics) : [],
          ai_analysis: row.ai_analysis ? JSON.parse(row.ai_analysis) : null
        }))
      };
    } catch (error) {
      console.error('[BACKEND] Get projects error:', error);
      throw error;
    }
  }

  async getProject(id) {
    console.log('[BACKEND] getProject:', id);
    
    try {
      const result = await this.dbProjects.execute({
        sql: 'SELECT * FROM projects WHERE id = ?',
        args: [id]
      });
      
      if (result.rows.length === 0) {
        return { success: false, message: 'Projet non trouvé' };
      }
      
      const project = result.rows[0];
      
      return {
        success: true,
        project: {
          ...project,
          topics: project.topics ? JSON.parse(project.topics) : [],
          ai_analysis: project.ai_analysis ? JSON.parse(project.ai_analysis) : null
        }
      };
    } catch (error) {
      console.error('[BACKEND] Get project error:', error);
      throw error;
    }
  }

  async getStats() {
    console.log('[BACKEND] getStats');
    
    try {
      const totalResult = await this.dbProjects.execute(
        'SELECT COUNT(*) as total FROM projects'
      );
      
      const langResult = await this.dbProjects.execute(`
        SELECT language, COUNT(*) as count 
        FROM projects 
        WHERE language IS NOT NULL 
        GROUP BY language 
        ORDER BY count DESC 
        LIMIT 10
      `);
      
      const catResult = await this.dbProjects.execute(`
        SELECT category, COUNT(*) as count 
        FROM projects 
        WHERE category IS NOT NULL 
        GROUP BY category 
        ORDER BY count DESC 
        LIMIT 10
      `);
      
      return {
        success: true,
        stats: {
          total_projects: totalResult.rows[0].total,
          by_language: langResult.rows,
          by_category: catResult.rows
        }
      };
    } catch (error) {
      console.error('[BACKEND] Get stats error:', error);
      throw error;
    }
  }

  // ========== IA ASSISTANT ==========
  
  async getRecommendations(userInput, userContext = {}) {
    console.log('[BACKEND] getRecommendations:', userInput);
    
    try {
      const keywords = userInput.toLowerCase();
      
      let filters = {};
      
      if (keywords.includes('javascript') || keywords.includes('js')) {
        filters.language = 'JavaScript';
      } else if (keywords.includes('python')) {
        filters.language = 'Python';
      } else if (keywords.includes('java') && !keywords.includes('javascript')) {
        filters.language = 'Java';
      } else if (keywords.includes('typescript') || keywords.includes('ts')) {
        filters.language = 'TypeScript';
      } else if (keywords.includes('go') || keywords.includes('golang')) {
        filters.language = 'Go';
      }
      
      if (keywords.includes('auth') || keywords.includes('authentification')) {
        filters.category = 'authentication';
      } else if (keywords.includes('api') || keywords.includes('rest')) {
        filters.category = 'api';
      } else if (keywords.includes('database') || keywords.includes('db')) {
        filters.category = 'database';
      } else if (keywords.includes('ui') || keywords.includes('interface')) {
        filters.category = 'ui';
      }
      
      const projects = await this.getProjects({ ...filters, limit: 10 });
      
      return {
        success: true,
        intent: {
          detected_language: filters.language,
          detected_category: filters.category,
          original_query: userInput
        },
        recommendations: projects.projects
      };
    } catch (error) {
      console.error('[BACKEND] Get recommendations error:', error);
      throw error;
    }
  }

  // ========== SCANNER ==========
  
  async saveProject(projectData) {
    console.log('[BACKEND] saveProject:', projectData.full_name);
    
    try {
      await this.dbProjects.execute({
        sql: `
          INSERT INTO projects (
            github_id, name, full_name, description, language, 
            stars, topics, readme_content, ai_analysis, 
            utility_score, category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(github_id) DO UPDATE SET
            stars = excluded.stars,
            readme_content = excluded.readme_content,
            ai_analysis = excluded.ai_analysis,
            utility_score = excluded.utility_score,
            scanned_at = CURRENT_TIMESTAMP
        `,
        args: [
          projectData.github_id,
          projectData.name,
          projectData.full_name,
          projectData.description,
          projectData.language,
          projectData.stars,
          JSON.stringify(projectData.topics || []),
          projectData.readme_content,
          JSON.stringify(projectData.ai_analysis || {}),
          projectData.utility_score || 0,
          projectData.category
        ]
      });
      
      console.log('[BACKEND] Project saved successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [BACKEND] Error saving project:', error);
      return { success: false, error: error.message };
    }
  }
}