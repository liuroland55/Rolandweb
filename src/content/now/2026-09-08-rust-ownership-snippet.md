---
title: 所有权的善后
date: 2026-09-08T11:15:00
kind: 代码
body: |
  fn take(s: String) {
      println!("{s}");
  } // s 在这里被丢弃，所有权的善后到此为止
---
