import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { productCategories, categoryMessages } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { sessionMiddleware, requireAuth } from "./middleware";

// Helper function to get society ID from JWT (no DB query needed)
const getUserSocietyId = (user: any): string => {
  if (!user.societyId) {
    throw new Error('User societyId not found in JWT');
  }
  return user.societyId;
};

export function registerCategoryRoutes(app: Express) {
  // Get all categories for a society
  app.get("/api/categories", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      const language = req.headers['accept-language'] || 'eu';
      const fallbackLanguage = language === 'eu' ? 'es' : 'eu';
      
      // First try to get messages in the requested language
      let categories = await db
        .select({
          id: productCategories.id,
          color: productCategories.color,
          icon: productCategories.icon,
          sortOrder: productCategories.sortOrder,
          isActive: productCategories.isActive,
          societyId: productCategories.societyId,
          createdAt: productCategories.createdAt,
          updatedAt: productCategories.updatedAt,
          name: categoryMessages.name,
          description: categoryMessages.description,
        })
        .from(productCategories)
        .leftJoin(categoryMessages, and(
          eq(categoryMessages.categoryId, productCategories.id),
          eq(categoryMessages.language, language as string)
        ))
        .where(and(
          eq(productCategories.societyId, societyId),
          eq(productCategories.isActive, true)
        ))
        .orderBy(asc(productCategories.sortOrder));
      
      // For categories without messages in the requested language, get fallback language
      const categoriesWithFallback = await Promise.all(
        categories.map(async (category) => {
          if (!category.name) {
            // Get fallback language message
            const fallbackMessage = await db
              .select({
                name: categoryMessages.name,
                description: categoryMessages.description,
              })
              .from(categoryMessages)
              .where(and(
                eq(categoryMessages.categoryId, category.id),
                eq(categoryMessages.language, fallbackLanguage)
              ))
              .limit(1);
            
            if (fallbackMessage.length > 0) {
              return {
                ...category,
                name: fallbackMessage[0].name,
                description: fallbackMessage[0].description,
              };
            }
          }
          return category;
        })
      );
      
      res.json(categoriesWithFallback);
    } catch (error) {
      next(error);
    }
  });

  // Get a single category by ID
  app.get("/api/categories/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      const language = req.headers['accept-language'] || 'eu';
      const fallbackLanguage = language === 'eu' ? 'es' : 'eu';
      
      // First try to get message in the requested language
      let category = await db
        .select({
          id: productCategories.id,
          color: productCategories.color,
          icon: productCategories.icon,
          sortOrder: productCategories.sortOrder,
          isActive: productCategories.isActive,
          societyId: productCategories.societyId,
          createdAt: productCategories.createdAt,
          updatedAt: productCategories.updatedAt,
          name: categoryMessages.name,
          description: categoryMessages.description,
        })
        .from(productCategories)
        .leftJoin(categoryMessages, and(
          eq(categoryMessages.categoryId, productCategories.id),
          eq(categoryMessages.language, language as string)
        ))
        .where(and(
          eq(productCategories.id, id),
          eq(productCategories.societyId, societyId)
        ))
        .limit(1);
      
      if (!category.length) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // If no message in requested language, try fallback
      if (!category[0].name) {
        const fallbackMessage = await db
          .select({
            name: categoryMessages.name,
            description: categoryMessages.description,
          })
          .from(categoryMessages)
          .where(and(
            eq(categoryMessages.categoryId, id),
            eq(categoryMessages.language, fallbackLanguage)
          ))
          .limit(1);
        
        if (fallbackMessage.length > 0) {
          category[0] = {
            ...category[0],
            name: fallbackMessage[0].name,
            description: fallbackMessage[0].description,
          };
        }
      }
      
      res.json(category[0]);
    } catch (error) {
      next(error);
    }
  });

  // Create a new category
  app.post("/api/categories", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      // Check if user has permission (admin or manager)
      if (!['administratzailea', 'diruzaina'].includes(user.function || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { messages, ...categoryData } = req.body;
      
      // Create the category
      const [newCategory] = await db.insert(productCategories)
        .values({
          ...categoryData,
          societyId,
        })
        .returning();
      
      // Create category messages for both languages
      if (messages) {
        const messageData = Object.entries(messages).map(([language, messageData]: [string, any]) => ({
          categoryId: newCategory.id,
          language,
          name: messageData.name,
          description: messageData.description || null,
        }));
        
        await db.insert(categoryMessages).values(messageData);
      }
      
      res.status(201).json(newCategory);
    } catch (error) {
      next(error);
    }
  });

  // Update a category
  app.put("/api/categories/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      // Check if user has permission (admin or manager)
      if (!['administratzailea', 'diruzaina'].includes(user.function || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if category exists and belongs to society
      const existingCategory = await db
        .select()
        .from(productCategories)
        .where(and(
          eq(productCategories.id, id),
          eq(productCategories.societyId, societyId)
        ))
        .limit(1);
      
      if (!existingCategory.length) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const { messages, ...categoryData } = req.body;
      
      // Update the category
      const updatedCategory = await db.update(productCategories)
        .set({ ...categoryData, updatedAt: new Date() })
        .where(eq(productCategories.id, id))
        .returning();
      
      // Update category messages if provided
      if (messages) {
        for (const [language, messageData] of Object.entries(messages)) {
          const msg = messageData as { name: string; description?: string };
          const existingMessage = await db.select().from(categoryMessages)
            .where(and(
              eq(categoryMessages.categoryId, id),
              eq(categoryMessages.language, language)
            ))
            .limit(1);

          if (existingMessage.length > 0) {
            // Update existing message
            await db.update(categoryMessages)
              .set({ 
                name: msg.name,
                description: msg.description || null,
                updatedAt: new Date() 
              })
              .where(eq(categoryMessages.id, existingMessage[0].id));
          } else {
            // Create new message
            await db.insert(categoryMessages).values({
              categoryId: id,
              language,
              name: msg.name,
              description: msg.description || null,
            });
          }
        }
      }
      
      res.json(updatedCategory[0]);
    } catch (error) {
      next(error);
    }
  });

  // Delete a category (soft delete - set isActive to false)
  app.delete("/api/categories/:id", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      // Check if user has permission (admin or manager)
      if (!['administratzailea', 'diruzaina'].includes(user.function || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if category exists and belongs to society
      const existingCategory = await db
        .select()
        .from(productCategories)
        .where(and(
          eq(productCategories.id, id),
          eq(productCategories.societyId, societyId)
        ))
        .limit(1);
      
      if (!existingCategory.length) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      await db.update(productCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productCategories.id, id));
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Reorder categories (update sort order)
  app.put("/api/categories/reorder", sessionMiddleware, requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryIds } = req.body;
      const user = req.user!;
      const societyId = getUserSocietyId(user);
      
      // Check if user has permission (admin or manager)
      if (!['administratzailea', 'diruzaina'].includes(user.function || '')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update sort order for each category
      const updates = categoryIds.map((categoryId: string, index: number) =>
        db.update(productCategories)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(and(
            eq(productCategories.id, categoryId),
            eq(productCategories.societyId, societyId)
          ))
      );
      
      await Promise.all(updates);
      
      res.json({ message: "Categories reordered successfully" });
    } catch (error) {
      next(error);
    }
  });
}
