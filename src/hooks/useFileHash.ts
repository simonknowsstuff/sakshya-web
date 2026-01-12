import { useState, useCallback } from 'react';

export const useFileHash = () => {
  const [hash, setHash] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateHash = useCallback(async (file: File): Promise<string> => {
    setIsHashing(true);
    setProgress(0);
    setHash(null);

    try {
      // Using the SubtleCrypto API for high-performance hashing:
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      setHash(hashHex);
      return hashHex;
    } catch (error) {
      console.error("Hashing failed:", error);
      throw error;
    } finally {
      setIsHashing(false);
      setProgress(100);
    }
  }, []);

  return { hash, isHashing, progress, generateHash };
};