export async function googleGet(accessToken, url) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    }
  });
  return readApiResponse(response);
}

export async function readApiResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.error?.message ?? data.error_description ?? data.raw ?? response.statusText;
    throw new Error(message);
  }
  return data;
}
