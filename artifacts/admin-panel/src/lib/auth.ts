export const getToken = () => localStorage.getItem("altogen_admin_token");
export const setToken = (token: string) => localStorage.setItem("altogen_admin_token", token);
export const clearToken = () => localStorage.removeItem("altogen_admin_token");

export const authHeaders = () => {
  const token = getToken();
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
};
