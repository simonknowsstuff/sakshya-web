import { useState, useCallback } from 'react';
import { createSHA256 } from 'hash-wasm';

export const useFileHash = () => {
  const [hash, setHash] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateHash = useCallback(async (file: File): Promise<string> => {
    setIsHashing(true);
    setProgress(0);
    setHash(null);

    try {
      const sha256 = await createSHA256();
      sha256.init();

      const reader = file.stream().getReader();
      const totalSize = file.size;
      let processedSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        sha256.update(value);

        processedSize += value.length;
        setProgress(Math.round((processedSize / totalSize) * 100));
      }

      const hex = sha256.digest('hex');
      setHash(hex);
      return hex;

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