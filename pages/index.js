import Head from "next/head";
import React, { useState, useEffect } from "react";
import Header from "@components/Header";
import ThemeSwitcher from "@components/ThemeSwitcher";
import FontSwitcher from "@components/FontSwitcher";
import Buttons from "@components/Buttons";
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
  const [font, setFont] = useState("font-mono");

  function speak() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      } else {
        const msg = new SpeechSynthesisUtterance();
        msg.text = posts.content.replace(/(<([^>]+)>)/gi, "");
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
          content: `<img src="/loading.svg" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />`,
        });
        const res = await fetch(`/.netlify/functions/node-fetch?q=${url}`, {
          headers: { accept: "Accept: application/json" },
        })
          .then((x) => x.json())
          .then((msg) => {
            setPosts(msg);
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
        <title>{posts.title}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Progress />
      <div
        className={`w-full px-6 mx-auto text-xl max-w-6xl leading-normal text-center ${font}`}>
        <div className="prose mx-auto lg:prose-xl flex items-stretch py-6 text-xl leading-normal text-center print:hidden">
          <Header onClick={fetchData} />
          <ThemeSwitcher />
          <FontSwitcher onChange={changeFont} />
          <Buttons onSpeak={speak} />
        </div>
        <article className="prose mx-auto lg:prose-xl prose-zinc text-left">
          <h1 className="font-bold break-normal pt-6 pb-2 text-3xl md:text-4xl">
            {posts.title}
          </h1>
          <div
            className="description"
            dangerouslySetInnerHTML={{ __html: posts.content }}></div>
        </article>
      </div>

      <Sprite />
    </main>
  );
}
