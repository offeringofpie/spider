import Head from "next/head";
import React, { useState, useEffect } from "react";
import Header from "@components/Header";
import Drawer from "@components/Drawer";
import Progress from "@components/Progress";
import Sprite from "@components/Sprite";

const isUrl = (string) => {
  try {
    return Boolean(new URL(string));
  } catch (e) {
    return false;
  }
};

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [font, setFont] = useState("font-mono");

  function speak() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      } else {
        const msg = new SpeechSynthesisUtterance();
        if (localStorage.getItem("voice")) {
          let selectedVoice = window.speechSynthesis
            .getVoices()
            .filter((voice) => {
              return voice.name == localStorage.getItem("voice");
            });
          msg.voice = selectedVoice[0];
        }
        if (localStorage.getItem("rate")) {
          msg.rate = localStorage.getItem("rate");
        }
        if (localStorage.getItem("pitch")) {
          msg.pitch = localStorage.getItem("pitch");
        }

        msg.text =
          posts.title + "\n" + posts.content.replace(/(<([^>]+)>)/gi, "");
        window.speechSynthesis.speak(msg);
      }
    }
  }

  function changeFont(ev) {
    const value = ev.target.value;
    if (typeof window !== "undefined") {
      localStorage.setItem("font", value);
    }
    setFont(value);
  }

  async function fetchData(e) {
    let url = typeof e == "string" ? e : e.target.querySelector("#url").value;
    if (typeof e !== "string") {
      e.preventDefault();
    }

    if (isUrl(url)) {
      try {
        setPosts({
          title: "Loading",
          content: ``,
        });
        setLoading(true);
        const res = await fetch(`/.netlify/functions/node-fetch?q=${url}`, {
          headers: { accept: "Accept: application/json" },
        })
          .then((x) => x.json())
          .then((msg) => {
            setPosts(msg);
            setLoading(false);
          });
      } catch (err) {
        console.log(err);
      }
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (localStorage.getItem("font")) {
        setFont(localStorage.getItem("font"));
      }
      if (urlParams.get("q")) {
        fetchData(urlParams.get("q"));
      }
    }
  }, []);
  return (
    <main className="min-h-screen mx-auto text-center">
      <Head>
        <title>{`${posts.title ? posts.title : "Spider Parser"}`}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="description"
          content={`${
            posts.excerpt
              ? posts.excerpt
              : "Parse news articles and web pages with ease."
          }`}
        />
        {/* Twitter */}
        <meta name="twitter:card" content="summary" key="twcard" />
        <meta name="twitter:creator" content="jelo" key="twhandle" />

        {/* Open Graph */}
        <meta
          property="og:url"
          content={`${typeof window !== "undefined" ? window.location : ""}`}
          key="ogurl"
        />
        <meta
          property="og:image"
          content={`${
            posts.lead_image_url
              ? posts.lead_image_url
              : "https://spider.jlopes.eu/spiderweb.jpg"
          }`}
          key="ogimage"
        />
        <meta
          property="og:site_name"
          content="Spider Parser"
          key="ogsitename"
        />
        <meta
          property="og:title"
          content={`${posts.title ? posts.title : "Spider Parser"}`}
          key="ogtitle"
        />
        <meta
          property="og:description"
          content={`${
            posts.excerpt
              ? posts.excerpt
              : "Parse news articles and web pages with ease."
          }`}
          key="ogdesc"
        />
      </Head>

      <Progress />
      <div className="drawer drawer-end">
        <input id="drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content">
          <div
            className={`w-full px-6 mx-auto text-xl max-w-6xl leading-normal text-center ${font}`}>
            <div className="prose mx-auto lg:prose-xl flex items-stretch pt-10 pb-6 text-xl leading-normal text-center print:hidden">
              <Header onClick={fetchData} onSpeak={speak} />
            </div>
            <article className="prose mx-auto lg:prose-xl prose-zinc text-left">
              <h1 className="font-bold break-normal pt-6 pb-2 text-3xl md:text-4xl">
                {posts.title}
              </h1>
              <div
                className="description"
                dangerouslySetInnerHTML={{ __html: posts.content }}></div>
              {loading ? (
                <svg
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 animate-spin -ml-1 mr-3 h-10 w-10 text-primary"
                  viewBox="0 0 24 24">
                  <use href="#loading" />
                </svg>
              ) : (
                ""
              )}
            </article>
            <label
              htmlFor="drawer"
              className="drawer-button absolute right-2 top-2 text-primary-focus hover:text-primary cursor-pointer ease-linear duration-75 text-xxl">
              <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24">
                <use href="#spiderweb" />
              </svg>
              <span className="sr-only animate-spin">Open Menu</span>
            </label>
          </div>
        </div>
        <Drawer onFont={changeFont} />
      </div>

      <Sprite />
    </main>
  );
}
