export const compareArrays = (arr1: any, arr2: any) => {
  if (arr1 === arr2) return true; // Reference equality
  if (arr1.length !== arr2.length) return false; // Check length

  for (let i = 0; i < arr1.length; i++) {
    const item1 = arr1[i];
    const item2 = arr2[i];

    // Recursively compare arrays or objects
    const areObjects = typeof item1 === 'object' && typeof item2 === 'object';
    if (areObjects ? !compareObjects(item1, item2) : item1 !== item2) {
      return false;
    }
  }

  return true;
};

// Helper function to compare objects (used in compareArrays)
export const compareObjects = (obj1: any, obj2: any) => {
  if (obj1 === obj2) return true; // Primitive values and reference equality

  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return false; // Ensure both are non-null objects
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false; // Check if key lengths differ

  for (const key of keys1) {
    if (!keys2.includes(key) || !compareObjects(obj1[key], obj2[key])) {
      return false; // Recurse for nested objects
    }
  }

  return true;
};
