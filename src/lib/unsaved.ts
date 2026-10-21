// Holds only a boolean, never editorial content or authentication data.
let dirty = false;
export const hasUnsavedChanges = () => dirty;
export const setUnsavedChanges = (value: boolean) => {
  dirty = value;
};
