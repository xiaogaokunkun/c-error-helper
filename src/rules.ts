// 从 C语言报错翻译器.html 的 const RULES 数组原样提取，仅改头部为 export。
// 字段说明：k 关键词数组 / n 名称 / why 解释 / fix 修复建议数组 / code 示例(模板串) / t 简称 / s 严重度 e|w|i / p 优先级 / ig 可忽略。
// 内容未做任何改动（含 HTML 标签与实体，渲染层再转义）。
export const RULES: any[] = [
{k:["expected ';' before","expected a ';'"],s:"e",n:"上一行末尾漏了分号",t:"末尾漏了分号（这行或上一行）",
 code:`int a = 1;             // ✅ 每句结尾都要有分号
int b = 2;
printf("hello\\n");     // ✅ 函数调用后面也要

// ❌ 最常见的漏法：这行写完了忘加分号
int c = 3
printf("%d", c);`,
 why:"编译器在某个东西前面本来期待一个分号。它报的位置是「撞墙的地方」，不是出错的地方——真正少分号的是<strong>上面那一行</strong>。",
 fix:["看报错行号的<strong>上一行</strong>，末尾补 <code>;</code>",
      "如果报错那行是 <code>for</code> 循环：把括号里的<strong>两个逗号改回分号</strong> —— 初始化; 条件; 自增 三段之间必须用分号隔开",
      "结构体/枚举定义右边的 <code>}</code> 后面也要 <code>;</code>",
      "别在 <code>#include</code>、<code>#define</code> 后面加分号"]},

{k:["expected declaration or statement at end of input","expected '}' at end of input","expected declaration or statement"],s:"e",
 n:"花括号没配平，少了一个 <code>}</code>",
 code:`int main(){
    int n = 3;
    if (n > 0) {
        printf("正数\\n");
    }                  // ✅ if 的括号在这里闭合
    return 0;
}                      // ✅ main 的括号最后闭合`,
 why:"编译器读到文件末尾还在等一个结束大括号。通常是 if/for/while/函数 的 <code>{ }</code> 漏了右边。",
 fix:["用「代码体检」标签页一键查括号配对","缩进对齐后再数一遍：每个 <code>{</code> 都要有 <code>}</code>",
      "Dev-C++ 里把光标点在 <code>{</code> 上，它会高亮配对的 <code>}</code>"]},

{k:["undeclared (first use in this function)","was not declared in this scope","undeclared identifier","undefined identifier","use of undeclared identifier","is undefined"],s:"e",
 n:"用了一个没声明的变量名",
 code:`int main(){
    int sum = 0;       // ✅ 变量全部写在函数最上面
    double avg;        // ✅ 要用什么，先在这里声明
    int i;

    for (i = 0; i < 5; i++)
        sum = sum + i;

    avg = sum / 5.0;
    printf("%.2f\\n", avg);
    return 0;
}`,
 why:"三种可能：忘写类型声明、名字拼错了、或者它在别的函数里（局部变量出不了自己的函数）。",
 fix:["在函数开头补上声明：<code>int sum; double avg;</code>",
      "检查大小写和拼写（C 语言区分大小写：<code>Sum</code> ≠ <code>sum</code>）",
      "变量<strong>必须放在函数开头</strong>声明（C89 要求），不能想用才写"]},

{k:["stray '\\","stray '\\\\","stray"],p:0,s:"e",
 n:"代码里混进了中文全角字符",
 code:`int a = 1;          // ✅ 半角分号 ;
int b = 2, c = 3;   // ✅ 半角逗号 ,
if (a > 0) { }      // ✅ 半角括号 ( )

// ❌ 全角（中文输入法下敲的）—— 编译器只认半角：
//    ； ， （ ） ： 、 和全角空格`,
 why:"报错长这样：<code>stray '\\357' in program</code>。那个数字是八进制编码——你敲了中文标点（<code>，</code> <code>；</code> <code>：</code> <code>（</code>）或者中文空格、全角引号。它们在编译器眼里是乱码。",
 fix:["用「代码体检」标签页，它会直接把全角字符的位置标出来",
      "输入法切成<strong>英文半角</strong>再改那几个符号",
      "最阴的是行尾的中文空格，肉眼看不出来"]},

{k:["invalid suffix"],p:0,s:"e",
 n:"数字后面粘上了中文标点（全角字符）",
 code:`count = count + 1;    // ✅ 半角分号，正常编译
count = count + 1；   // ❌ 全角分号 → invalid suffix
count = count + 1，   // ❌ 全角逗号 → 同样报错

// 记法：分号/逗号/括号都必须是英文输入法下敲出来的`,
 why:"<code>invalid suffix</code> 直译是「非法后缀」。编译器看到 <code>1；</code>，以为你在写 <code>1L</code>、<code>1U</code> 这类数字后缀，结果发现后面是一串中文字节。所以<strong>这条报错等于「你那一行里有全角标点」</strong>——报错里那个乱码引号，就是它读到的中文字。",
 fix:["把输入法切成<strong>英文半角</strong>，把那一行的标点重新敲一遍",
      "用「代码体检」标签页，它会直接标出全角字符的行号和列号",
      "最常见的三个：全角分号 <code>；</code>、全角逗号 <code>，</code>、全角括号 <code>（）</code>"]},

{k:["ld returned 1 exit status","id returned 1 exit status","ld returned"],s:"e",
 n:"链接失败（Dev-C++ 最出名的报错）",
 why:"注意：这个错<strong>本身没信息</strong>，真正的错误在上面几行，或者根本不是代码问题。常见三种：①上次的程序还开着，exe 被占用；②函数重名/重复定义；③<code>main</code> 拼成了 <code>mian</code>。",
 fix:["<strong>先把上次运行的黑窗口关掉</strong>，再重新编译——九成是这个",
      "在任务管理器里结束掉残留的 <code>.exe</code> 进程",
      "检查有没有 <code>main</code> 拼错，或者两个函数同名",
      "再往上看 5 行，找第一个 Error"]},

{k:["undefined reference to","undefined reference"],s:"e",
 n:"函数/变量声明了但没实现",
 why:"编译器知道有这么个东西，但找不到它的实体。要么函数只有原型没写函数体，要么库没链接上。",
 fix:["检查你调用的函数有没有写完整的 <code>{ ... }</code>",
      "函数名拼写要和定义完全一致",
      "用了数学库时：<code>#include &lt;math.h&gt;</code>，Dev-C++ 项目属性里加 <code>-lm</code>"]},

{k:["no such file or directory","cannot open source file","could not open source file","include errors detected","no directories in search list"],s:"e",
 n:"头文件找不到 / 文件名写错",
 why:"<code>#include &lt;stdio.h&gt;</code> 里的名字拼错了，或者用了 <code>&lt;iostream&gt;</code> 这种 C 里没有的头文件。",
 fix:["C 语言的头文件是 <code>stdio.h</code> <code>math.h</code> <code>string.h</code>，<strong>别写 .cpp 里的 iostream</strong>",
      "新建文件时要存成 <code>.c</code>；如果你存的 <code>.cpp</code>，就会按 C++ 规则报一堆怪错"]},

{k:["implicit declaration of function","incompatible implicit declaration"],s:"w",
 n:"没 <code>#include</code> 就把函数拿来用了",
 why:"编译器没见过 <code>scanf</code> / <code>printf</code> / <code>sqrt</code> 的声明，只能瞎猜。看着只是 warning，但很容易跑出诡异结果。",
 fix:["文件第一行加 <code>#include &lt;stdio.h&gt;</code>",
      "用了 sqrt/pow/fabs 再加 <code>#include &lt;math.h&gt;</code>",
      "用了 strlen/strcmp 加 <code>#include &lt;string.h&gt;</code>"]},

{k:["too few arguments to function","too many arguments to function"],s:"e",
 n:"函数调用的参数个数不对",
 why:"调用时传的参数数量，和定义/声明的不一样。最常见是 <code>scanf</code> 少写了变量，或者自定义函数<strong>调用时写了类型名</strong>（这是新手高发错误）。",
 fix:["<code>scanf(\"%d\", &amp;n);</code> —— 参数一个个数清楚",
      "调用自定义函数<strong>不要带类型</strong>：<code>sum(a,b);</code> 而不是 <code>int sum(int a,int b);</code>",
      "函数声明（原型）在后面才写函数体时，注意参数表要一致"]},

{k:["invalid operands to binary %","invalid operands to binary"],s:"e",
 n:"把 <code>%</code> 用在了小数上",
 code:`#include <stdio.h>
#include <math.h>

int main(){
    double a = 7.5, b = 2.0;
    printf("%.2f\\n", fmod(a, b));   // ✅ 小数取余用 fmod → 1.50

    int x = 7, y = 2;
    printf("%d\\n", x % y);          // ✅ % 只能对整数用 → 1
    return 0;
}`,
 why:"<code>%</code> 取余<strong>只能对整数</strong>用。你写的是 <code>7.5 % 2</code> 这种，编译器不认。",
 fix:["用 <code>fmod(7.5, 2)</code>（记得 <code>#include &lt;math.h&gt;</code>）",
      "如果本来想求余，确认两个操作数都是 <code>int</code>",
      "顺带检查：<code>/</code> 用在两个 int 上是<strong>整除</strong>，<code>5/2</code> 得 2 不是 2.5"]},

{k:["expects argument of type 'int *', but argument"],s:"w",p:1,
 n:"<code>scanf</code> 漏了取地址符 <code>&amp;</code>",
 code:`int n;
scanf("%d", &n);        // ✅ 普通变量前面必须加 &

char name[20];
scanf("%s", name);      // ✅ 数组名本身就是地址，不加 &

char ch;
scanf(" %c", &ch);      // ✅ 读字符时前面加空格，能吃掉上次的回车`,
 why:"格式串要 <code>%d</code>，它需要一个<strong>地址</strong>（<code>int *</code>），但你只给了变量的值（<code>int</code>）。编译器在提醒你少写了 <code>&amp;</code>。这种错运行时通常直接崩。",
 fix:["改成 <code>scanf(\"%d\", &amp;n);</code>——每个普通变量前面都要 <code>&amp;</code>",
      "<strong>例外</strong>：数组名和字符串本身已经是地址，不加 <code>&amp;</code>：<code>scanf(\"%s\", name);</code>",
      "读单个字符同样要加：<code>scanf(\"%c\", &amp;ch);</code>"]},

{k:["expects argument of type 'double', but argument","expects argument of type 'int', but argument"],s:"w",
 n:"<code>printf</code>/<code>scanf</code> 的格式符和变量类型对不上",
 code:`int    n = 5;
double x = 3.14;
char   ch = 'A';
char   s[] = "hi";

printf("%d\\n",    n);   // ✅ int    -> %d
printf("%.2f\\n",  x);   // ✅ double -> %f
printf("%c\\n",    ch);  // ✅ char   -> %c
printf("%s\\n",    s);   // ✅ 字符串 -> %s`,
 why:"<code>%d</code> 要的是 int，你给了 double；或者反过来 <code>%f</code> 给了 int。输出会变成一串垃圾数字。这是「程序不报错但结果乱」的头号原因。",
 fix:["int 用 <code>%d</code>，double 用 <code>%f</code>（或 <code>%lf</code>），float 用 <code>%f</code>，char 用 <code>%c</code>，字符串用 <code>%s</code>",
      "<strong>整数除法</strong>最容易踩：<code>average = sum/5</code> 里 sum 是 int 就会截断，写 <code>sum/5.0</code>",
      "<code>long long</code> 用 <code>%lld</code>"]},

{k:["lvalue required as left operand of assignment","lvalue required"],s:"e",
 n:"等号左边不是一个能装东西的变量",
 why:"两种典型：①把 <code>==</code> 写成了 <code>=</code>（<code>if (x+1 = 5)</code>）；②给表达式或常量赋值（<code>5 = x;</code> <code>a+b = c;</code>）。",
 fix:["判断相等用<strong>两个等号</strong> <code>==</code>；赋值才用 <code>=</code>",
      "等号左边只能是变量（或数组元素）",
      "宏定义里加括号，避免展开后跑到等号左边"]},

{k:["for' loop initial declarations are only allowed in","loop initial declarations"],s:"e",
 n:"在 <code>for</code> 里直接声明变量，但编译器按老标准（C89）",
 code:`int main(){
    int i;                     // ✅ C89 要求：变量放函数最上面

    for (i = 0; i < 5; i++)    // ✅ 循环里直接用，不重新声明
        printf("%d ", i);

    return 0;
}`,
 why:"<code>for (int i = 0; ...)</code> 是 C99 才允许的写法。Dev-C++ 有些配置默认按老标准编译，所以直接报错。",
 fix:["把变量挪到函数开头声明：<code>int i;</code> 然后写 <code>for (i = 0; ...)</code>",
      "或者加编译选项 <code>-std=c99</code>（项目属性 → 编译器 → 命令行）",
      "<strong>最省事的做法：所有变量都在函数最上面声明</strong>，老师也喜欢这种"]},

{k:["conversion from 'double' to 'int'","conversion from","possible loss of data"],s:"w",
 n:"小数被偷偷截成整数了",
 code:`int    sum = 256;
double avg;

avg = sum / 5.0;   // ✅ 除以小数，结果才是小数 → 51.2
avg = sum / 5;     // ❌ 两个 int 相除，小数被砍掉 → 51

printf("%.2f\\n", avg);`,
 why:"你把 double 赋给 int，小数部分直接扔掉（不是四舍五入，是砍掉）。<code>int n = 9.99;</code> 得到 <code>9</code>。",
 fix:["需要小数就声明成 <code>double</code>",
      "真要转整数用 <code>(int)(x + 0.5)</code> 才是四舍五入",
      "算平均分、单价这类题目，<strong>结果变量必须是 double</strong>"]},

{k:["array subscript is above array bounds","array subscript"],s:"w",
 n:"数组越界了",
 code:`int a[5];                   // ✅ 合法下标只有 a[0] ~ a[4]

for (i = 0; i < 5; i++)     // ✅ 用 < ，不要用 <=
    a[i] = i;

// ❌ a[5] 已经出界 —— 它踩的是别人的内存，变量会莫名其妙变值`,
 why:"<code>int a[5];</code> 只有 <code>a[0]</code> 到 <code>a[4]</code>。写 <code>a[5]</code> 就已经出界，会踩坏别的数据。",
 fix:["记死：<strong>下标从 0 开始，到 n-1 结束</strong>",
      "循环写 <code>for (i = 0; i &lt; n; i++)</code>，不要写 <code>i &lt;= n</code>",
      "数组大小 n 和下标 i 是两回事"]},

{k:["assignment makes pointer from integer without a cast","makes pointer from integer"],s:"w",
 n:"<code>scanf</code> 里漏了 <code>&amp;</code>",
 why:"<code>scanf(\"%d\", n);</code> 少了取地址符，编译器把 n 的值当成了地址。运行时通常会直接崩。",
 fix:["<code>scanf(\"%d\", &amp;n);</code> 每个普通变量前面都要 <code>&amp;</code>",
      "<strong>例外</strong>：数组名和字符串不用加 <code>&amp;</code>：<code>scanf(\"%s\", name);</code>"]},

{k:["redeclaration of","conflicting types for","previous definition"],s:"e",
 n:"同一个名字重复定义了",
 why:"同一个变量/函数在同一个作用域里声明了两次，或者声明和定义的类型不一致。",
 fix:["全局变量只声明一次",
      "函数原型和函数体的参数类型要完全一致",
      "检查是不是两个文件里都写了同名函数"]},

{k:["'main' must return 'int'","return type of 'main'"],s:"e",
 n:"<code>main</code> 的写法不对",
 why:"标准写法 <code>int main()</code>，有些编译器不认 <code>void main()</code>。虽然老书里常写 <code>void main</code>，但现在会被拦。",
 fix:["写 <code>int main()</code>，末尾 <code>return 0;</code>",
      "参数用 <code>int main(void)</code> 最规范"]},

{k:["cannot open output file","permission denied"],s:"e",
 n:"生成的 exe 被占用（程序还在运行）",
 why:"上一次运行的黑窗口没关，Windows 锁住了 <code>.exe</code>，这次编译写不进去。",
 fix:["把上次运行的黑窗口关掉",
      "任务管理器里结束残留进程",
      "或者把项目挪出 OneDrive / 桌面同步目录再试"]},

{k:["expected expression before","expected an expression"],s:"e",
 n:"某个符号前面缺了个东西（表达式不完整）",
 why:"常见是 <code>scanf(\"%d\",);</code> 漏参数、多打了一个逗号、或者 <code>printf</code> 里格式串和参数之间语法断了。",
 fix:["检查报错那个符号<strong>前面</strong>是不是少了变量或数值",
      "检查是不是多打了逗号或括号",
      "把那一行单独抄出来手动数一遍括号和逗号"]},

{k:["expected ')' before","expected a ')'"],s:"e",
 n:"圆括号没配对，或括号里内容写错",
 why:"<code>for (i = 0; i &lt; n; i++)</code> 里漏了括号、或者 <code>if (x &gt; 0</code> 没闭合。",
 fix:["用「代码体检」查括号配对",
      "注意 <code>for</code> 里是<strong>两个分号</strong>，不是逗号",
      "嵌套调用时一层层数"]},

{k:["expected '=' , ',' , ';' , 'asm' or","expected identifier or '(' before"],s:"e",
 n:"语句结构坏了（通常还是上面的老问题）",
 why:"这条报错很含糊，90% 的情况是上一行少分号、或者多了个孤零零的符号。",
 fix:["先看报错行的<strong>上一行</strong>要不要补 <code>;</code>",
      "看有没有把中文标点当英文用",
      "看有没有不小心敲出了一个多余的括号"]},

{k:["unused variable","set but not used"],s:"w",ig:1,
 n:"声明了变量但没用（这个警告可以忽略）",
 why:"不影响运行。编译器只是提醒你写了个没用的变量。",
 fix:["删掉不用就行，放着也不影响结果",
      "但如果这个变量<strong>本来该用</strong>，那说明你漏了逻辑"]},

{k:["control reaches end of non-void function"],s:"w",
 n:"有返回值的函数可能没走到 <code>return</code>",
 why:"函数声明返回 int，但某条路径走到底也没 return，返回值会是随机垃圾。",
 fix:["在函数最后补 <code>return 0;</code> 之类的兜底",
      "所有分支都要有返回值"]},

{k:["called object"],s:"e",
 n:"把变量当成函数调用了",
 why:"写了 <code>a(x)</code> 但 a 是个普通变量，不是函数。",
 fix:["检查那个名字到底是数组、变量还是函数",
      "数组取值用 <code>a[i]</code>，不是 <code>a(i)</code>"]},

{k:["expected 'while'","expected 'while' at"],s:"e",
 n:"<code>do-while</code> 少写了结尾分号",
 why:"<code>do { ... } while (条件)</code> 后面<strong>必须</strong>有分号。",
 fix:["写成 <code>} while (条件);</code> 别漏最后的 <code>;</code>"]},

{k:["invalid conversion","cannot convert"],s:"e",
 n:"类型不兼容（多见于你把文件存成了 .cpp）",
 why:"C 和 C++ 的类型检查严格程度不同。Dev-C++ 里如果文件扩展名是 <code>.cpp</code>，就会按 C++ 报一堆 C 里没有的错。",
 fix:["确认新建的文件是 <code>.c</code> 后缀",
      "课程作业一律用 <code>.c</code>，不要用 <code>.cpp</code>"]},

{k:["scanf_s","strcpy_s","strcat_s"],s:"e",
 n:"用了微软特有的 <code>_s</code> 版本函数",
 why:"<code>scanf_s</code> 是 Visual Studio 的东西，GCC / Dev-C++ 里根本不存在。抄了 VS 的代码就会报这个。",
 fix:["一律换成标准写法：<code>scanf(&quot;%d&quot;, &amp;n)</code>",
      "别抄网上 VS 的代码，或者手动把 <code>_s</code> 去掉"]},

{k:["expected primary-expression"],s:"e",
 n:"表达式缺了内容（通常是格式串或参数写坏）",
 why:"<code>printf</code>/<code>scanf</code> 里的格式串写断了，或者参数之间少了东西。",
 fix:["检查每个 <code>printf</code> 的引号是否<strong>成对</strong>",
      "检查 <code>%d</code> 的个数和后面变量个数是否一致",
      "格式串里想输出 <code>%</code> 本身要写 <code>%%</code>"]},

{k:["was not declared in this scope","'scanf' was not declared"],s:"e",
 n:"函数没声明（常见于 .cpp 文件里用 C 函数）",
 why:"文件存成了 <code>.cpp</code>，或者忘了 <code>#include &lt;stdio.h&gt;</code>。",
 fix:["加 <code>#include &lt;stdio.h&gt;</code>",
      "把文件改成 <code>.c</code>"]},

{k:["free(): invalid","double free","corrupted"],s:"e",
 n:"内存操作出错（指针/数组写飞了）",
 why:"这是<strong>运行时</strong>报错，往往是你往数组外面写了数据，踩坏了内存。",
 fix:["重点查数组下标是不是越界（从 0 开始，到 n-1）",
      "查循环边界是不是写了 <code>&lt;=</code>"]},

{k:["segmentation fault","程序奔溃","程序崩溃","将停止工作"],s:"e",
 n:"程序运行时崩溃（越界 / 空指针 / 死递归）",
 why:"编译通过了，一运行就死。绝大多数是：数组越界、忘了 <code>&amp;</code>、递归没有出口、除数为 0。",
 fix:["把数组下标和循环边界逐个核对",
      "检查 <code>scanf</code> 是否漏 <code>&amp;</code>",
      "递归函数必须有明确的终止条件"]},

{k:["suggest parentheses around assignment used as truth value","parentheses around assignment"],s:"w",p:1,
 n:"<code>if</code> 里把 <code>==</code> 写成了 <code>=</code>",
 why:"<code>if (n = 5)</code> 不是判断 n 是不是 5，而是把 5 <strong>赋值</strong>给 n，再判断这个值（非零=真），所以条件永远成立。程序不报错、编译也过，但逻辑全错了。",
 fix:["判断相等用<strong>两个等号</strong>：<code>if (n == 5)</code>",
      "记住：<code>=</code> 是赋值，<code>==</code> 才是判断",
      "防手滑写法：<code>if (5 == n)</code>，写错了编译器会直接报错拦你"]},

{k:["is used uninitialized"],s:"w",
 n:"变量声明了但没给初值就在用",
 why:"<code>int sum;</code> 只是要了一块内存，里面是<strong>上一次别人用剩的垃圾值</strong>。直接 <code>sum = sum + n;</code> 等于拿垃圾值来算。",
 fix:["声明时顺手给初值：<code>int sum = 0;</code>",
      "累加、计数类变量一律从 0 开始",
      "求最大值可以初始化成数组的第一个元素"]
}
];
