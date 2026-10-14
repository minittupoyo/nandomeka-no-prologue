import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { renderOgImage } from "@/lib/og";

export const getStaticPaths = (async () => {
  const posts = await getCollection("blog", ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return posts.map((post) => ({
    params: { id: post.id },
    props: { title: post.data.title },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage(props.title);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
