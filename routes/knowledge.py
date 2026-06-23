"""
Knowledge base blueprint — combinatorics & number theory reference pages.
"""
from flask import Blueprint, render_template

knowledge_bp = Blueprint('knowledge', __name__)


@knowledge_bp.route('/combinatorics')
def combinatorics():
    return render_template('knowledge_base.html',
                           kb='combinatorics',
                           title='组合数学基础知识目录',
                           subtitle='初等组合与竞赛组合定理总目录 · 100 条核心知识点')


@knowledge_bp.route('/number-theory')
def number_theory():
    return render_template('knowledge_base.html',
                           kb='number_theory',
                           title='初等数论基础知识目录',
                           subtitle='268 条定理与方法 · 覆盖高中数竞数论全部内容')
