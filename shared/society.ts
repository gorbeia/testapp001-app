import { Society } from "./schema";

// Helper functions for society management
export const getActiveSociety = async (): Promise<Society | null> => {
  // TODO: Replace with actual API call
  // For now, return the first society as active
  try {
    const response = await fetch("/api/societies");
    if (response.ok) {
      const societies: Society[] = await response.json();
      return societies.find(s => s.isActive) || societies[0] || null;
    }
  } catch (error) {
    console.error("Error fetching societies:", error);
  }
  return null;
};

export const getSocietyById = async (id: string): Promise<Society | null> => {
  // TODO: Replace with actual API call
  try {
    const response = await fetch(`/api/societies/${id}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error fetching society:", error);
  }
  return null;
};

export const createSociety = async (
  society: Omit<Society, "id" | "createdAt" | "updatedAt">
): Promise<Society | null> => {
  // TODO: Replace with actual API call
  try {
    const response = await fetch("/api/societies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(society),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error creating society:", error);
  }
  return null;
};

export const updateSociety = async (
  id: string,
  society: Partial<Society>
): Promise<Society | null> => {
  // TODO: Replace with actual API call
  try {
    const response = await fetch(`/api/societies/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(society),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error updating society:", error);
  }
  return null;
};

export const deleteSociety = async (id: string): Promise<boolean> => {
  // TODO: Replace with actual API call
  try {
    const response = await fetch(`/api/societies/${id}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch (error) {
    console.error("Error deleting society:", error);
  }
  return false;
};

export const toggleSocietyActive = async (id: string): Promise<Society | null> => {
  // TODO: Replace with actual API call
  try {
    const response = await fetch(`/api/societies/${id}/toggle`, {
      method: "POST",
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error toggling society active status:", error);
  }
  return null;
};
